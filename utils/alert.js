// utils/alert.js
// react-native-web's Alert.alert(title, message) is a silent no-op — it never
// renders anything, so any error/info dialog built on it is invisible on web
// (including the installed PWA). Use this for simple OK-only dialogs instead;
// it falls back to window.alert on web and native Alert.alert elsewhere.
import { Alert, Platform } from 'react-native';

export function showAlert(title, message) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
