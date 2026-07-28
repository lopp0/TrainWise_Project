/**
 * #156 — Localization dictionaries (EN / HE / FR).
 *
 * This is the FOUNDATION: it ships the mechanism (t(), language switch, RTL) and
 * a representative set of high-visibility strings (tab bar, common actions,
 * Settings section). Full string extraction across every screen is an ongoing
 * follow-up — untranslated keys fall back to English so nothing ever renders
 * blank.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', rtl: false },
  { code: 'he', label: 'עברית', rtl: true },
  { code: 'fr', label: 'Français', rtl: false },
];

export const translations = {
  en: {
    'tab.home': 'Home',
    'tab.load': 'Load',
    'tab.health': 'Health',
    'tab.connect': 'Connect',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.back': 'Back',
    'common.done': 'Done',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.account': 'Account',
    'settings.appearance': 'Appearance',
    'settings.notifications': 'Notifications',
    'settings.dangerZone': 'Danger Zone',
    'settings.deleteAccount': 'Delete my account',
    'settings.logout': 'Log out',
  },
  he: {
    'tab.home': 'בית',
    'tab.load': 'עומס',
    'tab.health': 'בריאות',
    'tab.connect': 'קהילה',
    'common.save': 'שמור',
    'common.cancel': 'ביטול',
    'common.delete': 'מחק',
    'common.back': 'חזרה',
    'common.done': 'סיום',
    'settings.title': 'הגדרות',
    'settings.language': 'שפה',
    'settings.account': 'חשבון',
    'settings.appearance': 'מראה',
    'settings.notifications': 'התראות',
    'settings.dangerZone': 'אזור מסוכן',
    'settings.deleteAccount': 'מחיקת החשבון שלי',
    'settings.logout': 'התנתקות',
  },
  fr: {
    'tab.home': 'Accueil',
    'tab.load': 'Charge',
    'tab.health': 'Santé',
    'tab.connect': 'Connect',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.back': 'Retour',
    'common.done': 'Terminé',
    'settings.title': 'Paramètres',
    'settings.language': 'Langue',
    'settings.account': 'Compte',
    'settings.appearance': 'Apparence',
    'settings.notifications': 'Notifications',
    'settings.dangerZone': 'Zone de danger',
    'settings.deleteAccount': 'Supprimer mon compte',
    'settings.logout': 'Se déconnecter',
  },
};
