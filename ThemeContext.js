// ThemeContext.js
import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const themes = {
  light: {
    background: '#f5f6fa',        // very light grey background
    text: '#707070ff',              // dark text for contrast
    label: '#858585',             // muted label text
    inputBackground: '#ffffff',   // pure white input background
    inputBorder: '#e0e0e0',       // light grey border
    editInputBackground: '#f0f4f8', // subtle blue-grey for edit
    editInputBorder: '#90caf9',     // soft blue border for edit
    button: '#e0e0e0',            // light grey button
    buttonText: '#f0f0f0',         // dark button text
    card: '#ffffff',               // white card
    cardBorder: '#e0e0e0',         // light card border
    tag: '#cdeaf7ff',                // pale blue tag
    tagText: '#547fa3ff',            // blue tag text
    pickerText: '#707070ff',         // dark picker text
    settingsIcon: '#858585',       // muted icon color
    bookmarkBorder: '#90caf9',     // blue accent for borders
    bottomBar: '#f0f0f0',          // very light bottom bar
    actionButton: '#f0f0f0',       // blue accent for action buttons
    actionButtonText: '#858585',   // dark text for action buttons
  },
  dark: {
    background: '#18191A',        // deep dark background
    text: '#a1a1a1ff',              // light grey text
    label: '#B0B3B8',             // muted label text
    inputBackground: '#242526',   // dark input background
    inputBorder: '#c76423ff',       // darker border
    editInputBackground: '#23272A',
    editInputBorder: '#3A3B3C',
    button: '#242526',            // matches input background
    buttonText: '#3b3b3bff',        // muted button text
    card: '#202124',              // slightly lighter than background
    cardBorder: '#23272A',        // subtle card border
    tag: '#c76423ff',               // dark tag background
    tagText: '#18191A',           // light tag text
    pickerText: '#E4E6EB',        // picker text
    settingsIcon: '#B0B3B8',      // icon color
    bookmarkBorder: '#969696ff',    // blue accent for borders
    bottomBar: '#23272A',         // matches button/input background
    actionButton: '#242526',      // blue accent for action buttons
    actionButtonText: '#a1a1a1ff',  // white text for action buttons
  },
  Pink: {
    background: '#ffe7e7ff',
    text: '#594100',
    label: '#644A07',
    inputBackground: '#FFC6C6',
    inputBorder: '#f7b1b1ff',
    editInputBackground: '#FFDBDB', // <--- new
    editInputBorder: '#ffb6c1',     // <--- new
    button: '#FFC6C6',
    buttonText: '#594100',
    card: '#FFC6C6',
    cardBorder: '#ffb6c1',
    tag: '#fcf087ff',
    tagText: '#594100',
    pickerText: '#594100',
    settingsIcon: '#594100',
    bookmarkBorder: '#594100',
    bottomBar: '#FFC6C6',
    actionButton: '#fcf087ff',  // example: pink
    actionButtonText: '#594100',
  },
  Orange: {
    background: '#fff5e1ff',
    text: '#e65100',
    label: '#e65100',
    inputBackground: '#cfe7bcff',
    inputBorder: '#e65100',
    editInputBackground: '#fff3e0', // <--- new
    editInputBorder: '#e65100',     // <--- new
    button: '#ffd180',
    buttonText: '#e65100',
    card: '#ffecb3',
    cardBorder: '#ffcc80',
    tag: '#b1df8bff',
    tagText: '#e65100',
    pickerText: '#e65100',
    settingsIcon: '#e65100',
    bookmarkBorder: '#e65100',
    bottomBar: '#ffd180',
    actionButton: '#ffb9b9ff',  // example: orange
    actionButtonText: '#e65100',
  },
  green: {
    background: '#eef5e8ff',
    text: '#2e7d32',
    label: '#1b5e20',
    inputBackground: '#A3DC9A',
    inputBorder: '#388e3c',
    editInputBackground: '#e0f2f1', // <--- new
    editInputBorder: '#80cbc4',     // <--- new
    button: '#a5d6a7',
    buttonText: '#1b5e20',
    card: '#DEE791',
    cardBorder: '#80cbc4',
    tag: '#FFF9BD',
    tagText: '#2e7d32',
    pickerText: '#2e7d32',
    settingsIcon: '#1b5e20',
    bookmarkBorder: '#1b5e20',
    bottomBar: '#a5d6a7',
    actionButton: '#FFD6BA',  // example: teal
    actionButtonText: '#1b5e20',
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