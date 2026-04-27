import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Colors, Spacing} from '../theme/colors';

const Card = ({children, style}) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default Card;
