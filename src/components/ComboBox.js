import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Colors, Fonts, Spacing} from '../theme/colors';

const ComboBox = ({
  items,
  selectedValue,
  onChange,
  labelKey = 'label',
  valueKey = 'value',
  placeholder = 'Select...',
  searchable = true,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = items.find((i) => i[valueKey] === selectedValue);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      String(i[labelKey] ?? '').toLowerCase().includes(q),
    );
  }, [items, query, labelKey]);

  const closeSheet = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text
          style={[styles.fieldText, !selected && styles.placeholderText]}
          numberOfLines={1}
        >
          {selected ? selected[labelKey] : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{placeholder}</Text>
            {searchable && (
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  placeholderTextColor={Colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <FlatList
              data={filteredItems}
              keyExtractor={(item, idx) =>
                String(item[valueKey] ?? idx)
              }
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyText}>No matches</Text>
              }
              renderItem={({item}) => {
                const isSelected = item[valueKey] === selectedValue;
                return (
                  <TouchableOpacity
                    style={[
                      styles.item,
                      isSelected && styles.itemSelected,
                    ]}
                    onPress={() => {
                      onChange(item);
                      closeSheet();
                    }}
                  >
                    <Text
                      style={[
                        styles.itemText,
                        isSelected && styles.itemTextSelected,
                      ]}
                    >
                      {item[labelKey]}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={Colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              style={styles.list}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  fieldText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    flex: 1,
    marginRight: Spacing.sm,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: Spacing.md,
    maxHeight: '75%',
  },
  sheetTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
    padding: 0,
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    fontSize: Fonts.bodySize,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemSelected: {
    backgroundColor: Colors.cardBackgroundLight,
  },
  itemText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
  },
  itemTextSelected: {
    color: Colors.primary,
    fontWeight: Fonts.bold,
  },
});

export default ComboBox;
