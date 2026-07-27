/**
 * #125 — Body-map injury picker regions.
 *
 * Tappable hotspots positioned on a 120 x 300 SVG viewBox (front + back views),
 * each mapping to the matching InjuryTypeID from the DB seed so tapping "left
 * knee" preselects Knee Pain in the report form. No new column: regions map onto
 * the existing injury types.
 */
export const FRONT_REGIONS = [
  { key: 'neck', label: 'Neck', injuryTypeId: 11, cx: 60, cy: 48, rx: 9, ry: 8 },
  { key: 'shoulderL', label: 'Shoulder', injuryTypeId: 9, cx: 38, cy: 70, rx: 10, ry: 9 },
  { key: 'shoulderR', label: 'Shoulder', injuryTypeId: 9, cx: 82, cy: 70, rx: 10, ry: 9 },
  { key: 'ribs', label: 'Ribs', injuryTypeId: 16, cx: 60, cy: 100, rx: 14, ry: 12 },
  { key: 'wristL', label: 'Wrist', injuryTypeId: 10, cx: 22, cy: 150, rx: 8, ry: 8 },
  { key: 'wristR', label: 'Wrist', injuryTypeId: 10, cx: 98, cy: 150, rx: 8, ry: 8 },
  { key: 'hip', label: 'Hip flexor', injuryTypeId: 14, cx: 60, cy: 150, rx: 14, ry: 9 },
  { key: 'groin', label: 'Groin', injuryTypeId: 13, cx: 60, cy: 168, rx: 9, ry: 8 },
  { key: 'quadL', label: 'Quad', injuryTypeId: 12, cx: 49, cy: 200, rx: 10, ry: 16 },
  { key: 'quadR', label: 'Quad', injuryTypeId: 12, cx: 71, cy: 200, rx: 10, ry: 16 },
  { key: 'kneeL', label: 'Knee', injuryTypeId: 1, cx: 49, cy: 232, rx: 9, ry: 8 },
  { key: 'kneeR', label: 'Knee', injuryTypeId: 1, cx: 71, cy: 232, rx: 9, ry: 8 },
  { key: 'shinL', label: 'Shin', injuryTypeId: 2, cx: 49, cy: 262, rx: 8, ry: 14 },
  { key: 'shinR', label: 'Shin', injuryTypeId: 2, cx: 71, cy: 262, rx: 8, ry: 14 },
  { key: 'footL', label: 'Foot', injuryTypeId: 8, cx: 49, cy: 290, rx: 8, ry: 7 },
  { key: 'footR', label: 'Foot', injuryTypeId: 8, cx: 71, cy: 290, rx: 8, ry: 7 },
];

export const BACK_REGIONS = [
  { key: 'neckB', label: 'Neck', injuryTypeId: 11, cx: 60, cy: 48, rx: 9, ry: 8 },
  { key: 'shoulderBL', label: 'Shoulder', injuryTypeId: 9, cx: 38, cy: 70, rx: 10, ry: 9 },
  { key: 'shoulderBR', label: 'Shoulder', injuryTypeId: 9, cx: 82, cy: 70, rx: 10, ry: 9 },
  { key: 'lowback', label: 'Lower back', injuryTypeId: 3, cx: 60, cy: 125, rx: 14, ry: 12 },
  { key: 'hamL', label: 'Hamstring', injuryTypeId: 5, cx: 51, cy: 205, rx: 9, ry: 16 },
  { key: 'hamR', label: 'Hamstring', injuryTypeId: 5, cx: 69, cy: 205, rx: 9, ry: 16 },
  { key: 'calfL', label: 'Calf', injuryTypeId: 15, cx: 49, cy: 262, rx: 8, ry: 14 },
  { key: 'calfR', label: 'Calf', injuryTypeId: 15, cx: 71, cy: 262, rx: 8, ry: 14 },
  { key: 'achL', label: 'Achilles', injuryTypeId: 7, cx: 49, cy: 286, rx: 6, ry: 8 },
  { key: 'achR', label: 'Achilles', injuryTypeId: 7, cx: 71, cy: 286, rx: 6, ry: 8 },
];
