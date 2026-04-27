// נקודת הכניסה הראשית של האפליקציה
import { registerRootComponent } from 'expo';
// ייבוא קומפוננט הבסיס של האפליקציה
import App from './App';
// רישום קומפוננט הבסיס כשורש האפליקציה — Expo ידאג להרצה הנכונה
registerRootComponent(App);
