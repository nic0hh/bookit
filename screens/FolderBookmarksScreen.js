// screens/FolderBookmarksScreen.js
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity } from 'react-native';
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
  const { colors } = useContext(ThemeContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [shuffledBookmarks, setShuffledBookmarks] = useState([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState([]);
  const debounceTimeout = useRef(null);
  const hasShuffled = useRef(false);

  useEffect(() => {
    const inThisFolder = bookmarks.filter(
      b => String(b.folderId) === String(folderId)
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

  const renderBookmark = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('BookmarkDetail', { bookmark: item })}
    >
      {item?.image ? (
        <Image
          source={{ uri: String(item.image) }}
          style={[styles.image, { height: item.height || 200 }]}
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
        numColumns={2}
        contentContainerStyle={styles.listContent}
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
    fontFamily: 'Quicksand',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    fontFamily: 'Quicksand',
    margin: 10,
    marginTop: 10,    // add this for spacing below header
    marginBottom: 0,  // remove extra space below search bar
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
