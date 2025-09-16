// App.js
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import HomeScreen from './screens/HomeScreen';
import AddScreen from './screens/AddScreen';
import FoldersScreen from './screens/FoldersScreen';
import { BookmarksProvider, BookmarksContext } from './context/BookmarksContext';
import BookmarkDetailScreen from './screens/BookmarkDetailScreen';
import FolderBookmarksScreen from './screens/FolderBookmarksScreen';
import { ThemeProvider, ThemeContext } from './ThemeContext';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { AuthProvider, AuthContext } from './context/AuthContext';
import AuthScreen from './screens/AuthScreen';

SplashScreen.preventAutoHideAsync();

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
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007aff',
        tabBarInactiveTintColor: 'gray',
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
    </Tab.Navigator>
  );
}

function AppInner() {
  const { colors, colorScheme } = React.useContext(ThemeContext);

  const navTheme = React.useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
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
  }, [colors, colorScheme]);

  const { migrating } = useContext(BookmarksContext);

  if (migrating) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
      }}>
        <ActivityIndicator size="large" color="#d72660" />
        <Text style={{ marginTop: 18, fontSize: 18, color: '#d72660', fontFamily: 'Quicksand' }}>
          Migrating your bookmarks...
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => {
            let iconName;
            switch (route.name) {
              case 'Home':
                iconName = 'home-outline';
                break;
              case 'Add':
                iconName = 'add-circle-outline';
                break;
              case 'Folders':
                iconName = 'folder-outline';
                break;
              default:
                iconName = 'ellipse-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.inputBorder,
          },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.label,
          // 👇 Add this for web only
          tabBarItemStyle: Platform.OS === 'web'
            ? { marginHorizontal: -12 } // negative margin brings icons closer
            : {},
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            unmountOnBlur: true,
          }}
        />
        <Tab.Screen name="Add" component={AddScreen} />
        <Tab.Screen name="Folders" component={FoldersScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function RootGate() {
  const { user, initializing, isVerified } = React.useContext(AuthContext);
  if (initializing) return null;
  if (!user) return <AuthScreen />;
  if (!isVerified) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 18, color: '#d72660', fontFamily: 'Quicksand', marginBottom: 18 }}>
          Please verify your email address to continue.
        </Text>
        <Text style={{ color: '#888', fontFamily: 'Quicksand', textAlign: 'center', marginBottom: 18 }}>
          Check your inbox for a verification link.
        </Text>
        <TouchableOpacity
          onPress={async () => {
            // Optionally, resend verification email
            await supabase.auth.resend({ type: 'signup', email: user.email });
            Alert.alert('Verification email sent', 'Check your inbox.');
          }}
          style={{ backgroundColor: '#d72660', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: '#fff', fontFamily: 'Quicksand', fontSize: 16 }}>Resend Email</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <AppInner />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Quicksand: require('./assets/fonts/Quicksand-Regular.ttf'),
    'Quicksand-Bold': require('./assets/fonts/Quicksand-Bold.ttf'),
  });

  React.useEffect(() => {
    if (fontsLoaded) {
      Text.defaultProps = Text.defaultProps || {};
      Text.defaultProps.style = [{ fontFamily: 'Quicksand', color: '#222' }, Text.defaultProps.style];

      TextInput.defaultProps = TextInput.defaultProps || {};
      TextInput.defaultProps.style = [{ fontFamily: 'Quicksand' }, TextInput.defaultProps.style];

      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <BookmarksProvider>
          <SafeAreaProvider>
            <RootGate />
          </SafeAreaProvider>
        </BookmarksProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// 🔹 Styles for the custom header
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
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'Quicksand-Bold',
    color: '#858585',
  },
});
