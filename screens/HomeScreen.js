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
  const { signOut, user } = useContext(AuthContext);
  const { theme, colors, setThemeName } = useContext(ThemeContext);
  const { bookmarks = [], folders = [], loading, reloadAll } = useContext(BookmarksContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [cardWidth, setCardWidth] = useState(200);
  const debounceTimeout = useRef(null);

  // Local UI state (missing -> caused ReferenceError)
  const [shuffledLocal, setShuffledLocal] = useState([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState([]);

  // Add this ref for web session shuffle
  const shuffledRef = useRef(null);
  const previousBookmarksLength = useRef(0);

  // Always reshuffle when bookmarks array changes
  useEffect(() => {
    if (bookmarks.length > 0) {
      console.log('Bookmarks changed - reshuffling. Count:', bookmarks.length);
      const shuffled = shuffleArray(bookmarks);
      
      if (Platform.OS === 'web') {
        shuffledRef.current = shuffled;
        previousBookmarksLength.current = bookmarks.length;
        setShuffledLocal(shuffled);
        setFilteredBookmarks(shuffled);
      } else {
        setShuffledLocal(shuffled);
        setFilteredBookmarks(shuffled);
      }
    } else {
      // Clear when no bookmarks
      shuffledRef.current = null;
      previousBookmarksLength.current = 0;
      setShuffledLocal([]);
      setFilteredBookmarks([]);
    }
  }, [bookmarks]);

  // Debounced search (by title or tags)
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      const q = searchQuery.toLowerCase();
      if (!q) {
        setFilteredBookmarks(shuffledLocal);
      } else {
        const filtered = shuffledLocal.filter(
          b =>
            b.title?.toLowerCase().includes(q) ||
            b.tags?.some(tag => tag.toLowerCase().includes(q))
        );
        setFilteredBookmarks(filtered);
      }
    }, 150);
  }, [searchQuery, shuffledLocal]);

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

  // when deriving visible bookmarks:
  const visible = (filteredBookmarks || []).filter(b => {
    // Show bookmarks with no folder (folder_id is null)
    if (!b.folder_id) return true;
    // Hide bookmarks from hidden folders
    const f = folders.find(x => x.id === b.folder_id);
    return !f?.hidden;
  });
  // use `visible` for rendering instead of shuffledBookmarks

  // Render each bookmark card
const renderBookmark = ({ item }) => (
  <View style={{ padding: 4, flex: 1 }}>
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.card, borderWidth: 0.7, borderColor: colors.cardBorder },
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
                  height: window.innerWidth < 600 ? 110 : 180, // 👈 shorter image for phone browser
                }
              : { height: item.height || 160 },
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
  </View>
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
              flex: 1, // fill available space
            },
          ]}
          placeholder="Search bookmarks or tags"
          placeholderTextColor={colors.label}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={{
            marginLeft: 10,
            padding: 8,
            alignSelf: 'center',
          }}
          onPress={() => setSettingsVisible(true)}
        >
          <Ionicons name="settings-outline" size={28} color={colors.settingsIcon} />
        </TouchableOpacity>
      </View>

      {/* Responsive columns for MasonryList */}
      <MasonryList
        data={visible}
        keyExtractor={(item, idx) => item.id || idx.toString()}
        renderItem={renderBookmark}
        numColumns={Platform.OS === 'web' ? (window.innerWidth < 600 ? 2 : 5) : 2}
        contentContainerStyle={{
          paddingHorizontal: window.innerWidth < 600 ? 6 : 12,
          paddingTop: 10,
          paddingBottom: 10,
          gap: 8, // works for web
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: colors.label, textAlign: 'center', marginTop: 40, fontFamily: 'sans-serif' }}>
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
                <Text style={{
                  fontSize: 14,
                  color: colors.label,
                  marginBottom: 14,
                  ...(Platform.OS === 'web' ? { fontFamily: 'sans-serif' } : {}),
                }}>
                  {user.email}
                </Text>
              )}

              {/* Top border before themes */}
              <View style={{
                width: '100%',
                height: 1,
                backgroundColor: colors.inputBorder,
                marginBottom: 16,
              }} />

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
                  <Text style={{
                    fontSize: 16,
                    color: theme === t ? colors.buttonText : colors.text,
                    fontWeight: theme === t ? 'bold' : 'normal',
                    ...(Platform.OS === 'web' ? { fontFamily: 'sans-serif' } : {}),
                  }}>
                    {t.charAt(0).toUpperCase() + t.slice(1).replace('soft', '')}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Bottom border after themes */}
              <View style={{
                width: '100%',
                height: 1,
                backgroundColor: colors.inputBorder,
                marginTop: 8,
                marginBottom: 18,
              }} />

              <TouchableOpacity
                style={{ marginTop: 4, marginBottom: 14 }}
                onPress={() => {
                  reloadAll();
                  setSettingsVisible(false);
                }}
              >
                <Text style={{
                  fontSize: 14,
                  color: colors.label,
                  ...(Platform.OS === 'web' ? { fontFamily: 'sans-serif' } : {}),
                }}>
                  Reload Data
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginBottom: 18 }}
                onPress={() => {
                  signOut();
                  setSettingsVisible(false);
                }}
              >
                <Text style={{
                  fontSize: 15,
                  color: '#d72660',
                  ...(Platform.OS === 'web' ? { fontFamily: 'sans-serif' } : {}),
                }}>
                  Sign Out
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Text style={{
                  color: colors.label,
                  fontSize: 15,
                  ...(Platform.OS === 'web' ? { fontFamily: 'sans-serif' } : {}),
                }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remote loading indicator */}
      {loading && (
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
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    // flex: 1 is set inline above
  },
  card: {
    margin: 8, // Ensure margin around each card
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

