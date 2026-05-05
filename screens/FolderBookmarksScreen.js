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

// Convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Darken RGB values
function darkenRgb(rgb, factor = 0.6) {
  return {
    r: Math.floor(rgb.r * factor),
    g: Math.floor(rgb.g * factor),
    b: Math.floor(rgb.b * factor)
  };
}

// Convert RGB to hex
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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
      b => b.folder_ids && b.folder_ids.includes(folderId)
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

  const renderBookmark = ({ item }) => {
    // Pinterest-style: Calculate card width based on columns that will fit
    const windowWidth = Platform.OS === 'web' ? window.innerWidth : 400;
    const numCols = Platform.OS === 'web' ? Math.max(2, Math.min(Math.floor(windowWidth / 220), 8)) : 2;
    
    // Calculate actual card width (MasonryList divides space by columns)
    const horizontalPadding = (window.innerWidth < 600 ? 6 : 12) * 2; // from contentContainerStyle
    const availableWidth = windowWidth - horizontalPadding;
    const cardWidth = availableWidth / numCols - 8; // 8 for margin on each card
    
    // Calculate image height based on actual card width
    const imageHeight = (item.image_width && item.image_height)
      ? (cardWidth * item.image_height) / item.image_width
      : 300; // fallback for images without dimensions

    return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderWidth: 0.7,
          borderColor: colors.cardBorder,
          margin: 4,
        },
      ]}
      onPress={() => navigation.navigate('BookmarkDetail', { bookmark: item })}
      activeOpacity={0.85}
    >
      {Platform.OS === 'web' ? (
        <div className="bookmark-card-wrapper" style={{ position: 'relative' }}>
          <img
            src={item.image}
            style={{
              width: '100%',
              height: `${imageHeight}px`,
              objectFit: 'cover',
              objectPosition: `50% ${(item.image_position_y ?? 0.5) * 100}%`,
              borderRadius: '18px',
              display: 'block',
            }}
          />
          
          {/* Overlay with gradient background */}
          <div 
            className="bookmark-overlay"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.1) 70%, rgba(0,0,0,0.03) 85%, transparent 100%)',
              padding: '12px',
              width: '100%',
              opacity: 0,
              transition: 'opacity 0.3s ease',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: '600', letterSpacing: '0.3px', textAlign: 'left', marginBottom: '6px', color: '#fff', textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
              {item?.title || 'Untitled'}
            </div>
            {item?.tags?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: '4px' }}>
                {item.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      borderRadius: '12px',
                      paddingTop: '4px',
                      paddingBottom: '4px',
                      paddingLeft: '10px',
                      paddingRight: '10px',
                      marginRight: '5px',
                      marginBottom: '5px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      color: '#fff',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <View style={{ position: 'relative' }}>
          {item?.image ? (
            <View style={{ height: imageHeight, width: '100%', overflow: 'hidden' }}>
              <Image
                source={{ uri: item.image }}
                style={{
                  width: null,
                  height: null,
                  flex: 1,
                  borderRadius: 18,
                }}
                resizeMode="cover"
              />
            </View>
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
          
          {/* Overlay with gradient background */}
          <View style={styles.overlay}>
            <View style={[styles.gradientOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
              <Text style={[styles.overlayTitle, { color: '#fff' }]}>
                {item?.title || 'Untitled'}
              </Text>
              {item?.tags?.length > 0 && (
                <View style={styles.tagsContainer}>
                  {item.tags.map((tag, idx) => (
                    <Text
                      key={idx}
                      style={[
                        styles.overlayTag,
                        { backgroundColor: 'rgba(255, 255, 255, 0.3)', color: '#fff' }
                      ]}
                    >
                      {tag}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* CSS for hover effect */}
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          .bookmark-card-wrapper:hover .bookmark-overlay {
            opacity: 1 !important;
          }
        `}} />
      )}
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
        numColumns={Platform.OS === 'web' ? Math.max(2, Math.min(Math.floor(window.innerWidth / 220), 8)) : 2}
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
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  gradientOverlay: {
    padding: 12,
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'left',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayTag: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 5,
    marginBottom: 5,
    fontSize: 12,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
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
