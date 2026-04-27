// קובץ הגדרות ESLint — מגדיר כללי lint לפרויקט
// תיעוד רשמי: https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
// הגדרות ESLint המוכנות של Expo (flat config format)
const expoConfig = require('eslint-config-expo/flat');

// ייצוא ההגדרות — מאמץ את כללי Expo ומוסיף התעלמות מתיקיית הבילד
module.exports = defineConfig([
  // הגדרות Expo הסטנדרטיות (rules, plugins, parsers)
  expoConfig,
  {
    // התעלמות מקבצי הבילד שנוצרים אוטומטית — אין צורך ל-lint אותם
    ignores: ['dist/*'],
  },
]);
