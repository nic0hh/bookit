// screens/FolderBookmarksScreen.js
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useContext, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import MasonryList from '@react-native-seoul/masonry-list';
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

export default function FolderBookmarksScreen({ navigation, route }) {
  const { folderId, folderName } = route.params;
  const { bookmarks } = useContext(BookmarksContext);
  const { colors, setThemeName } = useContext(ThemeContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [shuffledBookmarks, setShuffledBookmarks] = useState([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState([]);
  const [cardWidth, setCardWidth] = useState(200);
  const debounceTimeout = useRef(null);
  const hasShuffled = useRef(false);

  useEffect(() => {
    const inThisFolder = bookmarks.filter(
      b => b.folder_id === folderId
    );
    const base = hasShuffled.current ? inThisFolder : shuffleArray(inThisFolder);
    if (!hasShuffled.current) {
      hasShuffled.current = true;
    }
    setShuffledBookmarks(base);
    setFilteredBookmarks(base);
  }, [bookmarks, folderId]);

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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: folderName,
      headerTitleStyle: {
        color: colors.text,
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerLeft: () => (
        <TouchableOpacity
          style={{ paddingHorizontal: 16 }}
          onPress={() => navigation.navigate('Folders')} // 👈 always go to FoldersScreen
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, folderName, colors.text, colors.background]);

  const renderBookmark = ({ item }) => (
    <View style={{ padding: 4, flex: 1 }}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderWidth: 0.7,
            borderColor: colors.cardBorder,
          },
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
                    height: window.innerWidth < 600 ? 110 : 180,
                  }
                : { height: item.height || 200 },
            ]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.imagePlaceholder,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <Text style={{ color: colors.label }}>No image</Text>
          </View>
        )}
        <Text style={[styles.title, { color: colors.text }]}>
          {item?.title || 'Untitled'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
      <MasonryList
        data={filteredBookmarks}
        keyExtractor={(item, idx) => item.id || idx.toString()}
        renderItem={renderBookmark}
        numColumns={Platform.OS === 'web' ? (window.innerWidth < 600 ? 2 : 5) : 2}
        contentContainerStyle={{
          paddingHorizontal: window.innerWidth < 600 ? 6 : 12, // match HomeScreen
          paddingTop: 10,
          paddingBottom: 10,
          gap: 8, // consistent gap for web
        }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    elevation: 4,
  },
  topBarTitle: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    marginTop: 10,
    marginBottom: 0,
  },
  card: {
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
    fontSize: 18,
    letterSpacing: 0.5,
    fontWeight: 'normal',
    textAlign: 'center',
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
  },
  tagHighlighted: {},
  listContent: {
    padding: 10,
  },
});
