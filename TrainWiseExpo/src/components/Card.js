import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Spacing} from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

const Card = ({children, style}) => {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
};

const makeStyles = (Colors) => StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default Card;
