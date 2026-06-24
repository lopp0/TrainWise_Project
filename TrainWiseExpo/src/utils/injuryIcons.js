// Maps each seeded InjuryType (IDs 1-20, see CLAUDE.md reference data) to a
// MaterialCommunityIcons glyph + a color. Used by the home Add-Injury slider
// (B-2) and the redesigned InjuryReportScreen (B-7).
//
// Every glyph below is verified present in the installed MaterialCommunityIcons
// set (checked against the glyphmap 2026-06-20). MCI has no dedicated knee /
// neck / spine glyphs, so body-part-less injuries use the nearest coherent
// glyph (a cane for a knee/leg issue, a foot/heel for lower-leg injuries, etc.)
// rather than a misleading wrong-limb one. The old map showed Knee Pain as
// `account-injury`, which depicts an arm in a sling — that's the "broken arm"
// the user flagged; it's now `human-cane`.

export const INJURY_ICONS = {
  1:  { name: 'human-cane',        color: '#ff5252' }, // Knee Pain (leg/mobility)
  2:  { name: 'run-fast',          color: '#ff6d00' }, // Shin Splints
  3:  { name: 'seat-recline-extra', color: '#ffd740' }, // Lower Back Pain
  4:  { name: 'foot-print',        color: '#ff4081' }, // Ankle Sprain
  5:  { name: 'human-handsdown',   color: '#e040fb' }, // Hamstring Strain
  6:  { name: 'run',               color: '#40c4ff' }, // ITB Syndrome
  7:  { name: 'shoe-heel',         color: '#69f0ae' }, // Achilles Tendinopathy
  8:  { name: 'foot-print',        color: '#ffd740' }, // Plantar Fasciitis
  9:  { name: 'arm-flex',          color: '#ff6d00' }, // Shoulder Impingement
  10: { name: 'hand-back-right',   color: '#40c4ff' }, // Wrist Strain
  11: { name: 'human',             color: '#e040fb' }, // Neck Strain (upright posture)
  12: { name: 'walk',              color: '#ff5252' }, // Quadriceps Strain (leg)
  13: { name: 'human-male',        color: '#ff8a65' }, // Groin Pull
  14: { name: 'human-handsup',     color: '#ce93d8' }, // Hip Flexor Pain
  15: { name: 'shoe-cleat',        color: '#80deea' }, // Calf Strain (lower leg)
  16: { name: 'lungs',             color: '#ffb74d' }, // Rib Stress Injury
  17: { name: 'water',             color: '#bcaaa4' }, // Foot Blister (fluid)
  18: { name: 'bone',              color: '#b39ddb' }, // Stress Fracture
  19: { name: 'medical-bag',       color: '#ff8a65' }, // Tendonitis
  20: { name: 'human-cane',        color: '#ff5252' }, // Patellar Tendinopathy (knee)
};

// Safe generic fallback — a real glyph.
export const FALLBACK_INJURY_ICON = { name: 'bandage', color: '#ff7a7a' };

export const getInjuryIcon = (injuryTypeId) =>
  (injuryTypeId != null && INJURY_ICONS[injuryTypeId]) || FALLBACK_INJURY_ICON;
