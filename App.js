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
    * {
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    input, textarea, select {
      -webkit-user-select: text;
      font-size: 16px !important;
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

// App.js
function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#858585',
        headerBackTitleVisible: false, // <-- hides back button text
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
        options={{ title: 'Bookmark Detail' }} // <-- change title here
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

// Create a root stack
const RootStack = createNativeStackNavigator();

function MainTabs() {
  const { colors } = useContext(ThemeContext);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = 'home-outline';
          } else if (route.name === 'Folders') {
            iconName = 'folder-outline';
          } else if (route.name === 'Add') {
            iconName = 'add-circle-outline';
          } else if (route.name === 'Profile') {
            iconName = 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarStyle: Platform.OS === 'web'
          ? {
              backgroundColor: colors.bottomBar, // 👈 use theme bottomBar color
              borderTopColor: colors.inputBorder,
              height: 56,
              paddingHorizontal: 0,
              justifyContent: 'center',
              display: 'flex',
              gap: 0,
            }
          : {
              backgroundColor: colors.bottomBar, // 👈 use theme bottomBar color
              borderTopColor: colors.inputBorder,
            },
        tabBarItemStyle: Platform.OS === 'web'
          ? {}
          : {},
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.label,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          unmountOnBlur: true,
        }}
        listeners={({ navigation }) => ({
          tabPress: e => {
            // Prevent default behavior
            e.preventDefault();
            // Reset the Home stack to the first screen
            navigation.navigate('Home', {
              screen: 'HomeMain',
            });
          },
        })}
      />
      <Tab.Screen name="Add" component={AddScreen} />
      <Tab.Screen name="Folders" component={FoldersScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
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
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background
      }}>
        <ActivityIndicator size="large" color={colors.tag} />
        <Text style={{ marginTop: 18, fontSize: 18, color: colors.tag }}>
          Migrating your bookmarks...
        </Text>
      </View>
    );
  }

  // NavigationContainer lives at the app root; return the navigator directly here
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
        <Text style={{ fontSize: 18, color: colors.tag, marginBottom: 18 }}>
          Please verify your email address to continue.
        </Text>
        <Text style={{ color: colors.label, textAlign: 'center', marginBottom: 18 }}>
          Check your inbox for a verification link.
        </Text>
        <TouchableOpacity
          onPress={async () => {
            // Optionally, resend verification email
            await supabase.auth.resend({ type: 'signup', email: user.email });
            Alert.alert('Verification email sent', 'Check your inbox.');
          }}
          style={{ backgroundColor: colors.tag, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: colors.card, fontSize: 16 }}>Resend Email</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <AppInner />;
}

export default function App() {
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

// Debug: intercept attempts to open blob: URLs (logs stack + prevents native crash)
try {
  const _openURL = Linking.openURL;
  Linking.openURL = async (url) => {
    try {
      if (typeof url === 'string' && url.startsWith('blob:')) {
        console.log('DEBUG: Linking.openURL called with blob URI:', url);
        console.trace();
        // prevent native "No suitable URL request handler" error — adjust behavior as needed
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
      console.log('DEBUG: Linking.canOpenURL called with blob URI:', url);
      console.trace();
      return false;
    }
    return _canOpen(url);
  };
} catch (e) {
  console.warn('DEBUG: Linking monkeypatch failed', e);
}

// Removed the RN.Image replacement block because assigning to RN.Image throws:
// TypeError: Cannot assign to property 'Image' which has only a getter
// If you still want image-debugging, create a separate DebugImage component and use it
// in places where you render <Image /> instead of attempting a global assignment.

// 🔹 Styles for the custom header
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? { fontFamily: 'sans-serif' } : {}),
  },
  search: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 8,
    marginRight: 10,
    ...(Platform.OS === 'web' ? { fontFamily: 'sans-serif' } : {}),
  },
  buttonText: {
    fontSize: 16,
    color: '#858585',
    ...(Platform.OS === 'web' ? { fontFamily: 'sans-serif' } : {}),
  },
});
