// screens/HomeScreen.js
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MasonryList from '@react-native-seoul/masonry-list';
import { AuthContext } from '../context/AuthContext';
import { BookmarksContext } from '../context/BookmarksContext';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../ThemeContext';

// Shuffle helper
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function HomeScreen({ navigation }) {
  const { bookmarks, reloadAll, loadingRemote } = useContext(BookmarksContext);
  const { signOut, user } = useContext(AuthContext);
  const { theme, colors, setThemeName } = useContext(ThemeContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [shuffledBookmarks, setShuffledBookmarks] = useState([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [cardWidth, setCardWidth] = useState(200);
  const debounceTimeout = useRef(null);

  // Add this ref for web session shuffle
  const shuffledRef = useRef(null);

  // Shuffle once
  useEffect(() => {
    if (bookmarks.length > 0) {
      if (Platform.OS === 'web') {
        // Only shuffle once per session
        if (!shuffledRef.current) {
          shuffledRef.current = shuffleArray(bookmarks);
        }
        setShuffledBookmarks(shuffledRef.current);
        setFilteredBookmarks(shuffledRef.current);
      } else {
        // On app, shuffle every time bookmarks change
        const shuffled = shuffleArray(bookmarks);
        setShuffledBookmarks(shuffled);
        setFilteredBookmarks(shuffled);
      }
    }
  }, [bookmarks]);

  // Debounced search (by title or tags)
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      const q = searchQuery.toLowerCase();
      if (!q) {
        setFilteredBookmarks(shuffledBookmarks);
      } else {
        const filtered = shuffledBookmarks.filter(
          b =>
            b.title?.toLowerCase().includes(q) ||
            b.tags?.some(tag => tag.toLowerCase().includes(q))
        );
        setFilteredBookmarks(filtered);
      }
    }, 150);
  }, [searchQuery, shuffledBookmarks]);

  // Responsive card width on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      function updateCardWidth() {
        const columns = 5;
        const gutter = 15;
        const totalGutter = gutter * (columns + 1);
        const width = Math.max(
          140,
          Math.floor((window.innerWidth - totalGutter) / columns)
        );
        setCardWidth(width);
      }
      updateCardWidth();
      window.addEventListener('resize', updateCardWidth);
      return () => window.removeEventListener('resize', updateCardWidth);
    }
  }, []);

  const CARD_IMAGE_HEIGHT = 280; // consistent fallback

  // Render each bookmark card
const renderBookmark = ({ item }) => (
  <TouchableOpacity
    style={[
      styles.card,
      { 
        backgroundColor: colors.card,
        borderWidth: 0.7, // 👈 add border
        borderColor: colors.cardBorder, // 👈 use theme border color
      },
      Platform.OS === 'web'
        ? { width: cardWidth, margin: 12 } // 👈 reduce from 20 to 12 for web
        : { margin: 8 },
    ]}
    onPress={() => navigation.navigate('BookmarkDetail', { bookmark: item })}
    activeOpacity={0.85}
  >
    {item?.image ? (
      <Image
        source={{ uri: String(item.image) }}
        style={[
          styles.image,
          Platform.OS === 'web'
            ? {
                aspectRatio:
                  item.imageWidth && item.imageHeight
                    ? item.imageWidth / item.imageHeight
                    : 1.5,
                height: item.imageWidth && item.imageHeight ? undefined : 300,
              }
            : { height: item.height || 200 },
        ]}
        resizeMode="cover"
      />
    ) : (
      <View style={[styles.imagePlaceholder, { backgroundColor: colors.inputBackground }]}>
        <Text style={{ color: colors.label }}>No image</Text>
      </View>
    )}
    <Text
      style={[
        styles.title,
        { 
          color: colors.text,
          fontSize: 17,
        }
      ]}
    >
      {item?.title || 'Untitled'}
    </Text>
    {Platform.OS === 'web' && item?.tags?.length > 0 && (
      <View style={styles.tagsContainer}>
        {item.tags.map((tag, idx) => (
          <Text
            key={idx}
            style={[
              styles.tag,
              { backgroundColor: colors.tag, color: colors.tagText },
              searchQuery.toLowerCase().includes(tag.toLowerCase())
                ? [styles.tagHighlighted, { backgroundColor: colors.gray, color: colors.background }]
                : null
            ]}
          >
            {tag}
          </Text>
        ))}
      </View>
    )}
  </TouchableOpacity>
);


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Top bar with search + settings */}
      <View style={styles.topBar}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.inputBackground,
              color: colors.text,
              borderColor: colors.inputBorder,
            },
          ]}
          placeholder="Search bookmarks or tags"
          placeholderTextColor={colors.label}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity onPress={() => setSettingsVisible(true)} style={{ marginLeft: 8 }}>
          <Ionicons name="settings-outline" size={24} color={colors.settingsIcon} />
        </TouchableOpacity>
      </View>

      {/* Masonry grid */}
      <MasonryList
        data={filteredBookmarks}
        keyExtractor={(item, idx) => item.id || idx.toString()}
        renderItem={renderBookmark}
        numColumns={Platform.OS === 'web' ? 5 : 2}
        contentContainerStyle={{
          padding: 10,
          paddingBottom: 0, // 👈 ensure no extra bottom padding
        }}
        ListEmptyComponent={
          !loadingRemote ? (
            <Text style={{ color: colors.label, textAlign: 'center', marginTop: 40, fontFamily: 'Quicksand' }}>
              No bookmarks yet
            </Text>
          ) : null
        }
      />

      {/* Settings modal */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={{ width: '100%', alignItems: 'center' }}>
              {user?.email && (
                <Text style={{ fontFamily: 'Quicksand', fontSize: 14, color: colors.label, marginBottom: 14 }}>
                  {user.email}
                </Text>
              )}

              <Text style={{ fontFamily: 'Quicksand', fontSize: 18, marginBottom: 16, color: colors.label }}>
                Theme
              </Text>

              {['light', 'dark', 'Pink', 'green', 'Orange'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    marginBottom: 10,
                    backgroundColor: theme === t ? colors.button : colors.inputBackground,
                    borderRadius: 12,
                    alignItems: 'center',
                    width: 200,
                  }}
                  onPress={() => {
                    setThemeName(t);
                    setSettingsVisible(false);
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Quicksand',
                      fontSize: 16,
                      color: theme === t ? colors.buttonText : colors.text,
                      fontWeight: theme === t ? 'bold' : 'normal',
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1).replace('soft', '')}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={{ marginTop: 4, marginBottom: 14 }}
                onPress={() => {
                  reloadAll();
                  setSettingsVisible(false);
                }}
              >
                <Text style={{ fontFamily: 'Quicksand', fontSize: 14, color: colors.label }}>Reload Data</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginBottom: 18 }}
                onPress={() => {
                  signOut();
                  setSettingsVisible(false);
                }}
              >
                <Text style={{ fontFamily: 'Quicksand', fontSize: 15, color: '#d72660' }}>Sign Out</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Text style={{ color: colors.label, fontFamily: 'Quicksand', fontSize: 15 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remote loading indicator */}
      {loadingRemote && (
        <View style={{ position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center' }}>
          <ActivityIndicator color={colors.label} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 0,
    // No fontFamily
  },
  card: {
    margin: 8,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  image: {
    width: '100%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    padding: 12,
    fontSize: 20,
    fontWeight: 'normal',
    letterSpacing: 0.5,
    textAlign: 'center',
    // No fontFamily
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'center',
  },
  tag: {
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 6,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 'normal',
    // No fontFamily
  },
  tagHighlighted: {
    // No fontFamily
  },
  listContent: {
    padding: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    borderRadius: 16,
    padding: 24,
    minWidth: 250,
    alignItems: 'center',
  },
});

