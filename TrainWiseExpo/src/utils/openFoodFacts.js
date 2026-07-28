/**
 * #166 — Open Food Facts barcode lookup.
 *
 * OFF is a free, keyless product database, so the client can query it directly
 * (no billable SKU / no server proxy needed). Results are cached in-memory for
 * the session so re-scanning the same product doesn't re-hit the network, and
 * every field is clamped/sanitised before use (untrusted third-party data).
 */
const CACHE = new Map(); // barcode -> { name, calories, brand } | null

const clampCalories = (n) => {
  const v = Math.round(Number(n) || 0);
  return v > 0 && v <= 950 ? v : null; // kcal per 100g; reject absurd values (pure fat ~900)
};

// Open Food Facts stores energy in several possible fields and units. Products
// vary: some carry kcal per 100g, some only kJ, some only per-serving. Try them
// all (converting kJ->kcal at 4.184) so we don't fail to read calories on a
// product that OFF *does* have, just under a different key.
const KJ_TO_KCAL = 1 / 4.184;
const extractKcalPer100g = (nutriments) => {
  if (!nutriments) return null;
  const n = nutriments;
  // 1) kcal per 100g (the ideal case)
  let v = clampCalories(n['energy-kcal_100g']);
  if (v) return v;
  // 2) kJ per 100g -> kcal
  const kj100 = Number(n['energy-kj_100g'] ?? n['energy_100g']); // energy_100g is kJ by OFF convention
  if (kj100 > 0) {
    v = clampCalories(kj100 * KJ_TO_KCAL);
    if (v) return v;
  }
  // 3) kcal per serving (better than nothing)
  v = clampCalories(n['energy-kcal_serving']);
  if (v) return v;
  // 4) kJ per serving -> kcal
  const kjServ = Number(n['energy-kj_serving'] ?? n['energy_serving']);
  if (kjServ > 0) {
    v = clampCalories(kjServ * KJ_TO_KCAL);
    if (v) return v;
  }
  // 5) generic kcal field
  return clampCalories(n['energy-kcal']);
};

const cleanText = (s, max = 80) =>
  typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, max) : '';

/**
 * Look up a product by barcode. Returns { barcode, name, brand, caloriesPer100g,
 * calories } where `calories` is a sensible default serving (per 100g), or null
 * when not found / offline. Never throws.
 */
export const lookupBarcode = async (barcode) => {
  const code = String(barcode || '').replace(/[^0-9]/g, '');
  if (!code) return null;
  if (CACHE.has(code)) return CACHE.get(code);

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,generic_name,brands,nutriments`,
      { headers: { 'User-Agent': 'TrainWise/1.0 (fitness app)' } }
    );
    if (!res.ok) {
      CACHE.set(code, null);
      return null;
    }
    const json = await res.json();
    if (json?.status !== 1 || !json?.product) {
      CACHE.set(code, null);
      return null;
    }
    const p = json.product;
    const name = cleanText(p.product_name) || cleanText(p.product_name_en) || cleanText(p.generic_name);
    const brand = cleanText((p.brands || '').split(',')[0], 40);
    // Robustly derive kcal/100g across OFF's several energy fields + units.
    const caloriesPer100g = extractKcalPer100g(p.nutriments);
    if (!name && caloriesPer100g == null) {
      CACHE.set(code, null);
      return null;
    }
    const out = {
      barcode: code,
      name: name || 'Scanned product',
      brand,
      caloriesPer100g,
      calories: caloriesPer100g, // default 100g serving
    };
    CACHE.set(code, out);
    return out;
  } catch {
    return null; // offline / network — don't cache a transient failure
  }
};
