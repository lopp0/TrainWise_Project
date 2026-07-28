import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getInjuryIcon } from '../utils/injuryIcons';

/**
 * Renders the icon for an injury type (by InjuryTypeID), with a safe generic
 * fallback so a missing/unknown id never breaks the render. Pass `color` to
 * override the injury's identity tint.
 */
const InjuryIcon = ({ injuryTypeId, size = 24, color }) => {
  const icon = getInjuryIcon(injuryTypeId);
  return (
    <MaterialCommunityIcons name={icon.name} size={size} color={color || icon.color} />
  );
};

export default InjuryIcon;
