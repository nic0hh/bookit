// App.js
import React, { useContext, useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, ActivityIndicator, Platform, Alert, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import { BookmarksProvider } from './context/BookmarksContext';
import { ProfilesProvider } from './context/ProfilesContext';
import { ThemeProvider, ThemeContext } from './ThemeContext';
import {
  useFonts,
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';

import HomeScreen from './screens/HomeScreen';
import AddScreen from './screens/AddScreen';
import FoldersScreen from './screens/FoldersScreen';
import { BookmarksContext } from './context/BookmarksContext';
import BookmarkDetailScreen from './screens/BookmarkDetailScreen';
import FolderBookmarksScreen from './screens/FolderBookmarksScreen';
import ProfileScreen from './screens/ProfileScreen';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import AuthScreen from './screens/AuthScreen';
import { supabase } from './supabaseClient';
import { AuthContext } from './context/AuthContext';

// Prevent zoom on mobile web browsers
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');
    * {
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
      font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    input, textarea, select {
      -webkit-user-select: text;
      font-size: 16px !important;
      font-family: 'Quicksand', sans-serif !important;
    }
    body {
      overflow: hidden;
      position: fixed;
      width: 100%;
      height: 100%;
    }
    #root {
      width: 100%;
      height: 100%;
      overflow: auto;
    }
  `;
  document.head.appendChild(style);
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Shared font style to use throughout the app
export const FONT = {
  regular: { fontFamily: 'Quicksand_400Regular' },
  medium: { fontFamily: 'Quicksand_500Medium' },
  semibold: { fontFamily: 'Quicksand_600SemiBold' },
  bold: { fontFamily: 'Quicksand_700Bold' },
};

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#858585',
        headerBackTitleVisible: false,
        headerTitleStyle: { fontFamily: 'Quicksand_600SemiBold' },
      }}
    >
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ headerShown: false, title: 'Home' }}
      />
      <Stack.Screen name="Add" component={AddScreen} options={{ title: 'Add Bookmark' }} />
      <Stack.Screen
        name="BookmarkDetail"
        component={BookmarkDetailScreen}
        options={{ title: 'Bookmark Detail' }}
      />
      <Stack.Screen
        name="FolderBookmarks"
        component={FolderBookmarksScreen}
        options={({ route, navigation }) => ({
          title: route.params?.folderName || 'Folder Bookmarks',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.navigate('Folders')} style={{ marginLeft: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#858585" />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
}

const RootStack = createNativeStackNavigator();

function MainTabs() {
  const { colors } = useContext(ThemeContext);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = 'home-outline';
          else if (route.name === 'Folders') iconName = 'folder-outline';
          else if (route.name === 'Add') iconName = 'add-circle-outline';
          else if (route.name === 'Profile') iconName = 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarLabelStyle: { fontFamily: 'Quicksand_600SemiBold', fontSize: 11 },
        tabBarStyle: Platform.OS === 'web'
          ? {
              backgroundColor: colors.bottomBar,
              borderTopColor: colors.inputBorder,
              height: 56,
              paddingHorizontal: 0,
              justifyContent: 'center',
              display: 'flex',
              gap: 0,
            }
          : {
              backgroundColor: colors.bottomBar,
              borderTopColor: colors.inputBorder,
            },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.label,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ unmountOnBlur: true }}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault();
            navigation.navigate('Home', { screen: 'HomeMain' });
          },
        })}
      />
      <Tab.Screen name="Add" component={AddScreen} />
      <Tab.Screen name="Folders" component={FoldersScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function AppInner() {
  const { colors, themeName } = useContext(ThemeContext);

  const navTheme = React.useMemo(() => {
    const base = themeName === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.inputBorder,
        primary: colors.text,
        notification: colors.tag,
      },
    };
  }, [colors, themeName]);

  const { migrating } = useContext(BookmarksContext);

  if (migrating) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.tag} />
        <Text style={{ marginTop: 18, fontSize: 18, color: colors.tag, fontFamily: 'Quicksand_500Medium' }}>
          Migrating your bookmarks...
        </Text>
      </View>
    );
  }

  return <MainTabs />;
}

function RootGate() {
  const { user, initializing, isVerified } = useContext(AuthContext);
  const { colors } = useContext(ThemeContext);

  if (initializing) return null;
  if (!user) return <AuthScreen />;
  if (!isVerified) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ fontSize: 18, color: colors.tag, marginBottom: 18, fontFamily: 'Quicksand_600SemiBold' }}>
          Please verify your email address to continue.
        </Text>
        <Text style={{ color: colors.label, textAlign: 'center', marginBottom: 18, fontFamily: 'Quicksand_400Regular' }}>
          Check your inbox for a verification link.
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await supabase.auth.resend({ type: 'signup', email: user.email });
            Alert.alert('Verification email sent', 'Check your inbox.');
          }}
          style={{ backgroundColor: colors.tag, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: colors.card, fontSize: 16, fontFamily: 'Quicksand_600SemiBold' }}>Resend Email</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <AppInner />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  // Wait for fonts before rendering anything
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ProfilesProvider>
            <BookmarksProvider>
              <NavigationContainer>
                <RootGate />
              </NavigationContainer>
            </BookmarksProvider>
          </ProfilesProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Debug: intercept attempts to open blob: URLs
try {
  const _openURL = Linking.openURL;
  Linking.openURL = async (url) => {
    try {
      if (typeof url === 'string' && url.startsWith('blob:')) {
        console.log('DEBUG: Linking.openURL called with blob URI:', url);
        return Promise.reject(new Error('Blocked blob: URL'));
      }
    } catch (e) {
      console.warn('DEBUG Linking.openURL wrapper error', e);
    }
    return _openURL(url);
  };

  const _canOpen = Linking.canOpenURL;
  Linking.canOpenURL = async (url) => {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      return false;
    }
    return _canOpen(url);
  };
} catch (e) {
  console.warn('DEBUG: Linking monkeypatch failed', e);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  search: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 8,
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    color: '#858585',
    fontFamily: 'Quicksand_400Regular',
  },
});
