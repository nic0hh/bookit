// App.js
import React, { useContext, useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity, StyleSheet, Text, ActivityIndicator, Platform, Alert, Linking } from 'react-native';
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
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Add" component={AddScreen} options={{ title: 'Add Bookmark' }} />
      <Stack.Screen name="BookmarkDetail" component={BookmarkDetailScreen} options={{ title: 'Edit Bookmark' }} />
      <Stack.Screen
        name="FolderBookmarks"
        component={FolderBookmarksScreen}
        options={({ route, navigation }) => ({
          title: route.params?.folderName || 'Folder',
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

function MainTabs() {
  const { colors } = useContext(ThemeContext);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        // ── Tab bar container ──
        tabBarStyle: {
          backgroundColor: colors.bottomBar,
          borderTopColor: colors.inputBorder,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 80 : 62,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          ...(Platform.OS === 'web' ? { height: 60, paddingBottom: 6, paddingTop: 6 } : {}),
        },

        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.label,

        tabBarLabelStyle: {
          fontFamily: 'Quicksand_600SemiBold',
          fontSize: 10,
          marginTop: 2,
        },

        // ── Per-tab icon ──
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home:    focused ? 'home'           : 'home-outline',
            Folders: focused ? 'folder'         : 'folder-outline',
            Add:     focused ? 'add-circle'     : 'add-circle-outline',
            Profile: focused ? 'person'         : 'person-outline',
          };
          const name = icons[route.name] || 'ellipse-outline';

          if (route.name === 'Add') {
  return (
    <View style={{ alignItems: 'center' }}>
      <Ionicons name={name} size={28} color={color} />
      {focused && (
        <View style={[tabStyles.activeDot, { backgroundColor: colors.text }]} />
      )}
    </View>
  );
}

          // Active tab gets a small indicator dot
          return (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name={name} size={22} color={color} />
              {focused && (
                <View style={[tabStyles.activeDot, { backgroundColor: colors.text }]} />
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ title: 'Home', unmountOnBlur: true }}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault();
            navigation.navigate('Home', { screen: 'HomeMain' });
          },
        })}
      />
      <Tab.Screen
        name="Folders"
        component={FoldersScreen}
        options={{ title: 'Folders' }}
      />
      <Tab.Screen
        name="Add"
        component={AddScreen}
        options={{ title: '' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function AppInner() {
  const { colors } = useContext(ThemeContext);

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
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.substring(1));
    if (params.get('type') === 'recovery') {
      setIsRecovery(true);
    }
  }, []);

  if (initializing) return null;
  if (isRecovery) return <AuthScreen />;
  if (!user) return <AuthScreen />;
  if (!isVerified) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ fontSize: 18, color: colors.tag, marginBottom: 18, fontFamily: 'Quicksand_600SemiBold' }}>
          Please verify your email to continue.
        </Text>
        <Text style={{ color: colors.label, textAlign: 'center', marginBottom: 18, fontFamily: 'Quicksand_400Regular' }}>
          Check your inbox for a verification link.
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await supabase.auth.resend({ type: 'signup', email: user.email });
            Alert.alert('Sent', 'Check your inbox.');
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
```

Then push:
```
git add App.js
git commit -m "Fix password reset flow for logged in users"
git push

function AppNavigationRoot() {
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

  return (
    <NavigationContainer theme={navTheme}>
      <RootGate />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ProfilesProvider>
            <BookmarksProvider>
              <AppNavigationRoot />
            </BookmarksProvider>
          </ProfilesProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const tabStyles = StyleSheet.create({
  addPill: {
    width: 44,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
});

// Blob URL safety patch
try {
  const _openURL = Linking.openURL;
  Linking.openURL = async (url) => {
    if (typeof url === 'string' && url.startsWith('blob:')) return Promise.reject(new Error('Blocked blob: URL'));
    return _openURL(url);
  };
  const _canOpen = Linking.canOpenURL;
  Linking.canOpenURL = async (url) => {
    if (typeof url === 'string' && url.startsWith('blob:')) return false;
    return _canOpen(url);
  };
} catch (e) {
}