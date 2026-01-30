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

export default function HomeScreen({ navigation }) {
  const { signOut, user } = useContext(AuthContext);
  const { theme, colors, setThemeName } = useContext(ThemeContext);
  const { bookmarks = [], folders = [], loading, reloadAll, updateBookmark } = useContext(BookmarksContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [cardWidth, setCardWidth] = useState(200);
  const [updatingDimensions, setUpdatingDimensions] = useState(false);
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

  // Bulk update missing dimensions
  const updateMissingDimensions = async () => {
    const missingDims = bookmarks.filter(b => b.image && (!b.image_width || !b.image_height));
    
    if (missingDims.length === 0) {
      alert('All bookmarks already have dimensions!');
      return;
    }
    
    const confirmed = confirm(`Update dimensions for ${missingDims.length} bookmarks? This may take a moment.`);
    if (!confirmed) return;
    
    setUpdatingDimensions(true);
    let updated = 0;
    
    for (const bookmark of missingDims) {
      try {
        // Use native browser Image instead of React Native's Image.getSize
        await new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = async () => {
            console.log(`Updating ${bookmark.title?.substring(0, 30)}: ${img.width}x${img.height}`);
            try {
              await updateBookmark(bookmark.id, {
                imageWidth: img.width,
                imageHeight: img.height,
              });
              updated++;
            } catch (err) {
              console.error(`Failed to update ${bookmark.title}:`, err);
            }
            resolve();
          };
          
          img.onerror = () => {
            console.log(`Failed to load ${bookmark.title?.substring(0, 30)}`);
            resolve(); // Continue anyway
          };
          
          img.src = bookmark.image;
        });
      } catch (err) {
        console.error('Error updating bookmark:', err);
      }
    }
    
    setUpdatingDimensions(false);
    alert(`Updated ${updated} of ${missingDims.length} bookmarks!`);
    await reloadAll();
  };

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
const renderBookmark = ({ item }) => {
  // Pinterest-style: Calculate card width based on columns that will fit
  const windowWidth = Platform.OS === 'web' ? window.innerWidth : 400;
  const numCols = Platform.OS === 'web' ? Math.max(2, Math.min(Math.floor(windowWidth / 220), 8)) : 2;
  
  // Calculate actual card width (MasonryList divides space by columns)
  const horizontalPadding = (windowWidth < 600 ? 6 : 12) * 2; // from contentContainerStyle
  const availableWidth = windowWidth - horizontalPadding;
  const cardWidth = availableWidth / numCols - 8; // 8 for margin on each card
  
  // Calculate image height based on actual card width
  const imageHeight = (item.image_width && item.image_height)
    ? (cardWidth * item.image_height) / item.image_width
    : 300; // fallback for images without dimensions

  // Debug logging
  if (item.image_width && item.image_height) {
    const aspectRatio = item.image_height / item.image_width;
    console.log(`${item.title?.substring(0, 30)}: ${item.image_width}x${item.image_height} (aspect: ${aspectRatio.toFixed(2)}), cardWidth: ${cardWidth.toFixed(0)}px, imageHeight: ${imageHeight.toFixed(0)}px`);
  }

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
            src={String(item.image)}
            style={{
              width: '100%',
              height: `${imageHeight}px`,
              minHeight: `${imageHeight}px`,
              maxHeight: 'none',
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
                source={{ uri: String(item.image) }}
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
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.inputBackground }]}>
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
                        { backgroundColor: 'rgba(255, 255, 255, 0.3)', color: '#fff' },
                        searchQuery.toLowerCase().includes(tag.toLowerCase())
                          ? styles.tagHighlighted
                          : null
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* CSS for hover effect */}
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          .bookmark-card-wrapper:hover .bookmark-overlay {
            opacity: 1 !important;
          }
        `}} />
      )}
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
        numColumns={Platform.OS === 'web' ? Math.max(2, Math.min(Math.floor(window.innerWidth / 220), 8)) : 2}
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
                style={{ marginBottom: 14 }}
                onPress={() => {
                  setSettingsVisible(false);
                  updateMissingDimensions();
                }}
                disabled={updatingDimensions}
              >
                <Text style={{
                  fontSize: 14,
                  color: updatingDimensions ? colors.label : colors.actionButton,
                  ...(Platform.OS === 'web' ? { fontFamily: 'sans-serif' } : {}),
                }}>
                  {updatingDimensions ? 'Updating...' : 'Fix Image Dimensions'}
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

