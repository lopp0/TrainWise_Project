import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getActivityIcon } from '../utils/activityIcons';

/**
 * Renders the icon for an activity type. Looks up by ActivityTypeID first,
 * then by type name, then a safe generic fallback — so it never renders a
 * missing glyph. Pass `color` to override the activity's identity tint
 * (e.g. to draw it white on a colored card).
 */
const ActivityIcon = ({ activityTypeId, typeName, size = 24, color }) => {
  const icon = getActivityIcon(activityTypeId, typeName);
  return (
    <MaterialCommunityIcons name={icon.name} size={size} color={color || icon.color} />
  );
};

export default ActivityIcon;
