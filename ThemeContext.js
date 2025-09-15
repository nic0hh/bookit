// ThemeContext.js
import React, { createContext, useState, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const ThemeContext = createContext();

export const lightColors = {
  background: '#f8f8fa',
  text: '#616161ff',
  label: '#858585',
  inputBackground: '#f8f8fa',
  inputBorder: '#ccc',
  button: '#e0e0e0',
  buttonText: '#858585',
  card: '#fff',
  tag: '#ffe0e6',
  tagText: '#d72660',
  pickerText: '#222',
  settingsIcon: '#858585',
};

export const darkColors = {
  background: '#212122ff',
  text: '#c9c9c9ff',
  label: '#bbb',
  inputBackground: '#313131ff',
  inputBorder: '#4e4e4eff',
  button: '#313131ff',
  buttonText: '#929292ff',
  card: '#363636ff',
  tag: '#353535ff',
  tagText: '#2e2e2eff',
  pickerText: '#c9c9c9ff',
  settingsIcon: '#a1a1a1ff',
};

export const softPinkColors = {
  background: '#fff0f6',
  text: '#ad1457',
  label: '#d81b60',
  inputBackground: '#fce4ec',
  inputBorder: '#f8bbd0',
  button: '#f8bbd0',
  buttonText: '#ad1457',
  card: '#fce4ec',
  tag: '#f8bbd0',
  tagText: '#ad1457',
  pickerText: '#ad1457',
  settingsIcon: '#d81b60',
};

export const softOrangeColors = {
  background: '#fff8e1',
  text: '#e65100',
  label: '#ff9800',
  inputBackground: '#ffecb3',
  inputBorder: '#ffe0b2',
  button: '#ffd180',
  buttonText: '#e65100',
  card: '#ffecb3',
  tag: '#ffd180',
  tagText: '#e65100',
  pickerText: '#e65100',
  settingsIcon: '#ff9800',
};

export const greenColors = {
  background: '#e8f5e9',
  text: '#2e7d32',
  label: '#1b5e20',
  inputBackground: '#c8e6c9',
  inputBorder: '#388e3c',
  button: '#a5d6a7',
  buttonText: '#1b5e20',
  card: '#a5d6a7',
  tag: '#c8e6c9',
  tagText: '#2e7d32',
  pickerText: '#2e7d32',      // <-- add this
  settingsIcon: '#1b5e20',    // <-- add this
};

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState('light'); // 'light', 'dark', 'softPink', 'softOrange', 'green'

  let colorScheme = theme;
  let colors;
  if (theme === 'softPink') {
    colors = softPinkColors;
  } else if (theme === 'softOrange') {
    colors = softOrangeColors;
  } else if (theme === 'green') {
    colors = greenColors;
  } else if (theme === 'dark') {
    colors = darkColors;
  } else {
    colors = lightColors;
  }

  const toggleTheme = () => {
    setTheme(prev =>
      prev === 'light' ? 'dark' :
      prev === 'dark' ? 'softPink' :
      prev === 'softPink' ? 'softOrange' :
      prev === 'softOrange' ? 'green' :
      prev === 'green' ? 'light' :
      'light'
    );
  };

  const value = useMemo(() => ({
    theme,
    setTheme,
    colors,
    colorScheme,
    toggleTheme,
  }), [theme, colorScheme, colors]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
