// screens/HomeScreen.js
import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MasonryList from '@react-native-seoul/masonry-list';
import { AuthContext } from '../context/AuthContext';
import { BookmarksContext } from '../context/BookmarksContext';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../ThemeContext';

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function HomeScreen({ navigation }) {
  const { bookmarks } = useContext(BookmarksContext);
  const { signOut, user } = useContext(AuthContext);
  const { theme, toggleTheme, colors, setTheme } = useContext(ThemeContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [shuffledBookmarks, setShuffledBookmarks] = useState([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState([]);
  const debounceTimeout = useRef(null);
  const hasShuffled = useRef(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const { reloadAll, loadingRemote } = useContext(BookmarksContext);

  useEffect(() => {
    if (bookmarks.length > 0 && !hasShuffled.current) {
      const shuffled = shuffleArray(bookmarks);
      setShuffledBookmarks(shuffled);
      setFilteredBookmarks(shuffled);
      hasShuffled.current = true;
    }
  }, [bookmarks]);

  useEffect(() => {
    if (hasShuffled.current) {
      setShuffledBookmarks(bookmarks);
      setFilteredBookmarks(bookmarks);
    }
  }, [bookmarks]);

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(() => {
      const queryTags = searchQuery.toLowerCase().split(' ').filter(Boolean);
      if (queryTags.length === 0) {
        setFilteredBookmarks(shuffledBookmarks);
      } else {
        const filtered = shuffledBookmarks.filter(b => {
          if (!b.tags || b.tags.length === 0) return false;
          return queryTags.every(qt =>
            b.tags.map(t => t.toLowerCase()).includes(qt)
          );
        });
        setFilteredBookmarks(filtered);
      }
    }, 150);
  }, [searchQuery, shuffledBookmarks]);

  const renderBookmark = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('BookmarkDetail', { bookmark: item })}
      activeOpacity={0.85}
    >
      {item?.image ? (
        <Image
          source={{ uri: String(item.image) }}
          style={[styles.image, { height: item.height || 200 }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: colors.inputBackground }]}>
          <Text style={{ color: colors.label }}>No image</Text>
        </View>
      )}
      <Text style={[styles.title, { color: colors.text }]}>{item?.title || 'Untitled'}</Text>
      {item?.tags?.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.map((tag, idx) => (
            <Text
              key={idx}
              style={[
                styles.tag,
                { backgroundColor: colors.tag, color: colors.tagText, fontFamily: 'Quicksand' },
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
      <MasonryList
        data={filteredBookmarks}
        keyExtractor={(item, idx) => item.id || idx.toString()}
        renderItem={renderBookmark}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 24,
            minWidth: 250,
            alignItems: 'center'
          }}>
            <View style={{ width: '100%', alignItems: 'center' }}>
              {user?.email && (
                <Text style={{ fontFamily: 'Quicksand', fontSize: 14, color: colors.label, marginBottom: 14 }}>
                  {user.email}
                </Text>
              )}

              <Text style={{ fontFamily: 'Quicksand', fontSize: 18, marginBottom: 16, color: colors.label }}>
                Theme
              </Text>

              {[
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
                { label: 'Pink', value: 'softPink' },
                { label: 'Green', value: 'green' },
                { label: 'Orange', value: 'softOrange' },
              ].map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    marginBottom: 10,
                    backgroundColor: theme === t.value ? colors.button : colors.inputBackground,
                    borderRadius: 12,
                    alignItems: 'center',
                    width: 200,
                  }}
                  onPress={() => {
                    setTheme(t.value);
                    setSettingsVisible(false);
                  }}
                >
                  <Text style={{
                    fontFamily: 'Quicksand',
                    fontSize: 16,
                    color: theme === t.value ? colors.buttonText : colors.text,
                    fontWeight: theme === t.value ? 'bold' : 'normal'
                  }}>
                    {t.label}
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
                <Text style={{ fontFamily: 'Quicksand', fontSize: 14, color: colors.label }}>
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
                <Text style={{ fontFamily: 'Quicksand', fontSize: 15, color: '#d72660' }}>
                  Sign Out
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Text style={{ color: colors.label, fontFamily: 'Quicksand', fontSize: 15 }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* (Optional) show loading indicator over content: */}
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
    backgroundColor: 'transparent',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    fontFamily: 'Quicksand',
    marginBottom: 0,
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  title: {
    padding: 12,
    fontSize: 19,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    fontFamily: 'Quicksand',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  tag: {
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 6,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Quicksand',
  },
  tagHighlighted: {
    fontFamily: 'Quicksand',
  },
  listContent: {
    padding: 10,
  },
});
