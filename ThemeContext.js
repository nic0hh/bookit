// ThemeContext.js
import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const themes = {
  light: {
    background: '#f8f8fa',
    text: '#616161',
    label: '#858585',
    inputBackground: '#f8f8fa',
    inputBorder: '#cccccc',
    button: '#e0e0e0',
    buttonText: '#858585',
    card: '#ffffff',
    tag: '#ffe0e6',
    tagText: '#d72660',
    pickerText: '#222222',
    settingsIcon: '#858585',
    bookmarkBorder: '#d72660',
  },
  dark: {
    background: '#212122',
    text: '#c9c9c9',
    label: '#bbbbbb',
    inputBackground: '#313131',
    inputBorder: '#4e4e4e',
    button: '#313131',
    buttonText: '#929292',
    card: '#363636',
    tag: '#353535',
    tagText: '#2e2e2e',
    pickerText: '#c9c9c9',
    settingsIcon: '#a1a1a1',
    bookmarkBorder: '#d72660',
  },
  softPink: {
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
    bookmarkBorder: '#d72660',
  },
  softOrange: {
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
    bookmarkBorder: '#d72660',
  },
  green: {
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
    pickerText: '#2e7d32',
    settingsIcon: '#1b5e20',
    bookmarkBorder: '#d72660',
  },
};

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeName, setThemeName] = useState('light');
  const [colors, setColors] = useState(themes[themeName]);

  // Load theme on mount
  useEffect(() => {
    if (Platform.OS === 'web' && globalThis.localStorage) {
      const saved = globalThis.localStorage.getItem('theme');
      if (saved && themes[saved]) {
        setThemeName(saved);
        setColors(themes[saved]);
      }
    } else {
      AsyncStorage.getItem('theme').then(saved => {
        if (saved && themes[saved]) {
          setThemeName(saved);
          setColors(themes[saved]);
        }
      });
    }
  }, []);

  // Save theme when changed
  useEffect(() => {
    if (Platform.OS === 'web' && globalThis.localStorage) {
      globalThis.localStorage.setItem('theme', themeName);
      setColors(themes[themeName]);
    } else {
      AsyncStorage.setItem('theme', themeName);
      setColors(themes[themeName]);
    }
  }, [themeName]);

  return (
    <ThemeContext.Provider value={{ colors, themeName, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}