// ComboBox — dropdown עם חיפוש, מוצג כ-Modal
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
// Ionicons לאייקוני חץ, חיפוש וסגירה
import {Ionicons} from '@expo/vector-icons';
// ייבוא צבעים, גופנים וריווחים מהתמה
import {Colors, Fonts, Spacing} from '../theme/colors';

/**
 * ComboBox — props:
 * items: מערך האפשרויות
 * selectedValue: ערך הבחירה הנוכחית
 * onChange: פונקציה שמקבלת את ה-item הנבחר
 * labelKey: שם השדה להצגה (ברירת מחדל 'label')
 * valueKey: שם השדה לזיהוי (ברירת מחדל 'value')
 * placeholder: טקסט כשאין בחירה
 * searchable: האם להציג חיפוש (ברירת מחדל true)
 */
const ComboBox = ({
  items,
  selectedValue,
  onChange,
  labelKey = 'label',
  valueKey = 'value',
  placeholder = 'Select...',
  searchable = true,
}) => {
  // האם הרשימה פתוחה
  const [open, setOpen] = useState(false);
  // מחרוזת החיפוש
  const [query, setQuery] = useState('');

  // חיפוש ה-item הנבחר ברשימה לפי ערך
  const selected = items.find((i) => i[valueKey] === selectedValue);

  // סינון הרשימה לפי מחרוזת החיפוש — useMemo מונע חישוב מחדש מיותר
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    // אם אין חיפוש — כל הרשימה
    if (!q) return items;
    // סינון לפי labelKey
    return items.filter((i) =>
      String(i[labelKey] ?? '').toLowerCase().includes(q),
    );
  }, [items, query, labelKey]);

  // סגירת ה-Modal + איפוס החיפוש
  const closeSheet = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View>
      {/* שדה הבחירה הראשי — לחיצה פותחת את ה-Modal */}
      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        {/* הצגת הבחירה הנוכחית או ה-placeholder */}
        <Text
          style={[styles.fieldText, !selected && styles.placeholderText]}
          numberOfLines={1}
        >
          {selected ? selected[labelKey] : placeholder}
        </Text>
        {/* חץ למטה */}
        <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Modal הרשימה — מוצג מעל שאר המסך */}
      <Modal
        visible={open}
        transparent              // רקע שקוף לתצוגת ה-overlay
        animationType="fade"
        onRequestClose={closeSheet}
      >
        {/* לחיצה על הרקע סוגרת את ה-Modal */}
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          {/* עצירת הפצת הלחיצה מהגיליון עצמו */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            {/* כותרת הגיליון */}
            <Text style={styles.sheetTitle}>{placeholder}</Text>
            {/* שדה חיפוש — מוצג רק אם searchable=true */}
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
                {/* כפתור ניקוי חיפוש — מוצג רק כשיש תוכן */}
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            {/* רשימת האפשרויות המסוננות */}
            <FlatList
              data={filteredItems}
              // keyExtractor — שימוש ב-valueKey או index כגיבוי
              keyExtractor={(item, idx) =>
                String(item[valueKey] ?? idx)
              }
              // מאפשר לחיצה על פריטים גם כשהמקלדת פתוחה
              keyboardShouldPersistTaps="handled"
              // הודעה כשאין תוצאות
              ListEmptyComponent={
                <Text style={styles.emptyText}>No matches</Text>
              }
              renderItem={({item}) => {
                // בדיקה אם זה הפריט הנבחר
                const isSelected = item[valueKey] === selectedValue;
                return (
                  <TouchableOpacity
                    style={[
                      styles.item,
                      isSelected && styles.itemSelected,  // הדגשת הנבחר
                    ]}
                    onPress={() => {
                      // עדכון הבחירה וסגירת ה-Modal
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
                    {/* ✓ לפריט הנבחר */}
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

// סגנונות הקומפוננט
const styles = StyleSheet.create({
  // שדה הבחירה הראשי
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
  // טקסט placeholder — אפור
  placeholderText: {
    color: Colors.textMuted,
  },
  // רקע overlay כהה
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  // גיליון הרשימה
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: Spacing.md,
    maxHeight: '75%',   // מגביל לשלושה רבעי גובה המסך
  },
  sheetTitle: {
    color: Colors.primary,
    fontSize: Fonts.subtitleSize,
    fontWeight: Fonts.bold,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  // שורת חיפוש
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
  // הודעת "אין תוצאות"
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    fontSize: Fonts.bodySize,
  },
  // הרשימה עצמה — לא מתמשכת לגובה כל הגיליון
  list: {
    flexGrow: 0,
  },
  // פריט ברשימה
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
  // פריט נבחר — הדגשת רקע
  itemSelected: {
    backgroundColor: Colors.cardBackgroundLight,
  },
  itemText: {
    color: Colors.textPrimary,
    fontSize: Fonts.bodySize,
  },
  // טקסט פריט נבחר — בצבע מותג ומודגש
  itemTextSelected: {
    color: Colors.primary,
    fontWeight: Fonts.bold,
  },
});

export default ComboBox;
