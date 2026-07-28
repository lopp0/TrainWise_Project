/**
 * #126 — Rehab / recovery suggestions per injury.
 *
 * Static reference data keyed by InjuryTypeID (matches the DB InjuryTypes seed,
 * ids 1-20). Bundled client-side so it works offline with no backend table. Each
 * entry is a short list of general self-care / mobility pointers. This is
 * educational guidance, NOT medical advice (a disclaimer is shown with it).
 */
const GENERIC = [
  'Rest and reduce load until pain settles.',
  'Ice for 15-20 min after activity if it feels inflamed.',
  'Ease back gradually. Stop if pain sharpens.',
];

export const REHAB_TIPS = {
  1: { name: 'Knee Pain', tips: ['Relative rest from impact; swap to cycling or swimming.', 'Strengthen quads and glutes (straight-leg raises, bridges).', 'Ice after activity; avoid deep squats while painful.'] },
  2: { name: 'Shin Splints', tips: ['Cut running volume; run on softer surfaces.', 'Calf raises and toe raises to build lower-leg strength.', 'Check footwear; ice the shin after runs.'] },
  3: { name: 'Lower Back Pain', tips: ['Keep gently moving; avoid prolonged sitting.', 'Core and glute work (bird-dog, dead-bug, bridges).', 'Hip-flexor and hamstring mobility; watch lifting form.'] },
  4: { name: 'Ankle Sprain', tips: ['RICE for the first 48h (rest, ice, compression, elevation).', 'Once pain allows, balance drills (single-leg stands).', 'Rebuild range of motion with ankle circles.'] },
  5: { name: 'Hamstring Strain', tips: ['Avoid aggressive stretching early; gentle range only.', 'Progress to eccentric strengthening (Nordic curls, slow lowers).', 'Return to sprinting gradually.'] },
  6: { name: 'ITB Syndrome', tips: ['Reduce downhill and high-mileage running.', 'Strengthen hip abductors (side-lying leg raises, clamshells).', 'Foam-roll the lateral thigh and glutes.'] },
  7: { name: 'Achilles Tendinopathy', tips: ['Reduce jumping and hill work.', 'Slow, heavy calf raises (eccentric heel drops).', 'Avoid sudden mileage jumps; warm up thoroughly.'] },
  8: { name: 'Plantar Fasciitis', tips: ['Calf and plantar-fascia stretching, especially mornings.', 'Roll the arch over a ball; supportive footwear.', 'Reduce barefoot time on hard floors.'] },
  9: { name: 'Shoulder Impingement', tips: ['Avoid painful overhead movements for now.', 'Rotator-cuff and scapular strengthening (band work).', 'Improve posture and thoracic mobility.'] },
  10: { name: 'Wrist Strain', tips: ['Rest from loaded gripping; brace if needed.', 'Gentle wrist flexor/extensor mobility once pain eases.', 'Progress grip strength gradually.'] },
  11: { name: 'Neck Strain', tips: ['Gentle range-of-motion; avoid holding one position.', 'Check screen and pillow ergonomics.', 'Light deep-neck-flexor and upper-back work.'] },
  12: { name: 'Quadriceps Strain', tips: ['Rest early; gentle range of motion only.', 'Progress to eccentric quad strengthening.', 'Warm up well before sprint or jump efforts.'] },
  13: { name: 'Groin Pull', tips: ['Avoid explosive side-to-side movements early.', 'Adductor strengthening (squeezes, Copenhagen plank).', 'Return to change-of-direction work gradually.'] },
  14: { name: 'Hip Flexor Pain', tips: ['Reduce high knee-drive and sprint volume.', 'Hip-flexor mobility plus glute and core strengthening.', 'Avoid prolonged sitting.'] },
  15: { name: 'Calf Strain', tips: ['Rest, then gentle calf range of motion.', 'Progressive calf raises (double then single leg).', 'Ease back into running; warm up the calves first.'] },
  16: { name: 'Rib Stress Injury', tips: ['Avoid loaded rotation and heavy breathing efforts.', 'Let it settle; breathing can be sore, keep it gentle.', 'Return to rowing/paddling only when pain-free.'] },
  17: { name: 'Foot Blister', tips: ['Keep it clean and covered; do not pop if intact.', 'Reduce friction (better-fitting shoes, moisture-wicking socks).', 'Let the skin heal before long sessions.'] },
  18: { name: 'Stress Fracture', tips: ['Stop impact loading and see a professional promptly.', 'Maintain fitness with non-impact work (pool, cycling) if cleared.', 'Return to running very gradually once cleared.'] },
  19: { name: 'Tendonitis', tips: ['Reduce the aggravating load; relative rest.', 'Progressive loading (isometrics then slow eccentrics).', 'Avoid sudden spikes in training volume.'] },
  20: { name: 'Patellar Tendinopathy', tips: ['Cut jumping/plyometric volume.', 'Isometric holds (wall sits) then heavy-slow resistance.', 'Load the tendon progressively, not explosively.'] },
};

/** Returns { name, tips[] } for an injury type id, with a generic fallback. */
export const getRehabTips = (injuryTypeId) => {
  const entry = REHAB_TIPS[injuryTypeId];
  if (entry) return entry;
  return { name: null, tips: GENERIC };
};

export const REHAB_DISCLAIMER =
  'General guidance only, not medical advice. See a professional if pain persists or worsens.';
