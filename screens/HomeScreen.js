// screens/HomeScreen.js
import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MasonryList from '@react-native-seoul/masonry-list';
import { AuthContext } from '../context/AuthContext';
import { BookmarksContext } from '../context/BookmarksContext';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../ThemeContext';

const GAP = 8;

// Theme swatch colours — one representative colour per theme
const THEME_SWATCHES = {
  light:  { color: '#e8e6e0', border: '#c0bdb8', label: 'Light' },
  dark:   { color: '#18191A', border: '#444',    label: 'Dark'  },
  Pink:   { color: '#FFC6C6', border: '#f7b1b1', label: 'Pink'  },
  green:  { color: '#a5d6a7', border: '#388e3c', label: 'Green' },
  Orange: { color: '#ffd180', border: '#e65100', label: 'Orange'},
};

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
  const { themeName, colors, setThemeName } = useContext(ThemeContext);
  const { bookmarks = [], folders = [], loading, reloadAll, updateBookmark } = useContext(BookmarksContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [updatingDimensions, setUpdatingDimensions] = useState(false);
  const debounceTimeout = useRef(null);

  const [shuffledLocal, setShuffledLocal] = useState([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState([]);

  const getWindowWidth = () => Platform.OS === 'web' ? window.innerWidth : 400;
  const [windowWidth, setWindowWidth] = useState(getWindowWidth());

  useEffect(() => {
    if (Platform.OS === 'web') {
      const onResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, []);

  useEffect(() => {
    if (bookmarks.length > 0) {
      const shuffled = shuffleArray(bookmarks);
      setShuffledLocal(shuffled);
      setFilteredBookmarks(shuffled);
    } else {
      setShuffledLocal([]);
      setFilteredBookmarks([]);
    }
  }, [bookmarks]);

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      const q = searchQuery.toLowerCase();
      if (!q) {
        setFilteredBookmarks(shuffledLocal);
      } else {
        setFilteredBookmarks(
          shuffledLocal.filter(
            b =>
              b.title?.toLowerCase().includes(q) ||
              b.tags?.some(tag => tag.toLowerCase().includes(q))
          )
        );
      }
    }, 150);
  }, [searchQuery, shuffledLocal]);

  const updateMissingDimensions = async () => {
    const missingDims = bookmarks.filter(b => b.image && (!b.image_width || !b.image_height));
    if (missingDims.length === 0) { alert('All bookmarks already have dimensions!'); return; }
    const confirmed = confirm(`Update dimensions for ${missingDims.length} bookmarks? This may take a moment.`);
    if (!confirmed) return;
    setUpdatingDimensions(true);
    let updated = 0;
    for (const bookmark of missingDims) {
      try {
        await new Promise((resolve) => {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = async () => {
            try {
              await updateBookmark(bookmark.id, { imageWidth: img.width, imageHeight: img.height });
              updated++;
            } catch (err) { console.error(`Failed to update ${bookmark.title}:`, err); }
            resolve();
          };
          img.onerror = () => resolve();
          img.src = bookmark.image;
        });
      } catch (err) { console.error('Error updating bookmark:', err); }
    }
    setUpdatingDimensions(false);
    alert(`Updated ${updated} of ${missingDims.length} bookmarks!`);
    await reloadAll();
  };

  const visible = (filteredBookmarks || []).filter(b => {
    if (!b.folder_id) return true;
    const f = folders.find(x => x.id === b.folder_id);
    return !f?.hidden;
  });

  const numCols = Platform.OS === 'web'
    ? Math.max(2, Math.min(Math.floor(windowWidth / 220), 8))
    : 2;

  const PADDING = windowWidth < 600 ? 6 : 12;
  const derivedCardWidth = (windowWidth - PADDING * 2 - GAP * (numCols + 1)) / numCols;

  const renderBookmark = ({ item }) => {
    const imageHeight = (item.image_width && item.image_height)
      ? (derivedCardWidth * item.image_height) / item.image_width
      : 300;

    return (
      <TouchableOpacity
        style={[styles.card, {
          backgroundColor: colors.card,
          borderWidth: 0.7,
          borderColor: colors.cardBorder,
        }]}
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
            <div
              className="bookmark-overlay"
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)',
                padding: '12px', width: '100%', opacity: 0,
                transition: 'opacity 0.3s ease',
                borderRadius: '0 0 18px 18px',
              }}
            >
              <div style={{ fontSize: '15px', fontWeight: '600', letterSpacing: '0.3px', textAlign: 'left', marginBottom: '6px', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.8)', fontFamily: 'Quicksand, sans-serif' }}>
                {item?.title || 'Untitled'}
              </div>
              {item?.tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '4px' }}>
                  {item.tags.map((tag, idx) => (
                    <span key={idx} style={{
                      borderRadius: '12px', padding: '3px 10px',
                      marginRight: '5px', marginBottom: '5px',
                      fontSize: '11px', fontWeight: '500',
                      backgroundColor: 'rgba(255,255,255,0.3)', color: '#fff',
                      fontFamily: 'Quicksand, sans-serif',
                    }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <View>
            {item?.image ? (
              <View style={{ height: imageHeight, width: '100%', overflow: 'hidden' }}>
                <Image
                  source={{ uri: String(item.image) }}
                  style={{ width: '100%', height: '100%', borderRadius: 18 }}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.inputBackground }]}>
                <Text style={{ color: colors.label }}>No image</Text>
              </View>
            )}
            {item?.title ? (
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          .bookmark-card-wrapper:hover .bookmark-overlay { opacity: 1 !important; }
        `}} />
      )}

      <View style={styles.topBar}>
        <TextInput
          style={[styles.searchInput, {
            backgroundColor: colors.inputBackground,
            color: colors.text,
            borderColor: colors.inputBorder,
            flex: 1,
            fontFamily: 'Quicksand_400Regular',
          }]}
          placeholder="Search bookmarks or tags"
          placeholderTextColor={colors.label}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={{ marginLeft: 10, padding: 8, alignSelf: 'center' }}
          onPress={() => setSettingsVisible(true)}
        >
          <Ionicons name="settings-outline" size={28} color={colors.settingsIcon} />
        </TouchableOpacity>
      </View>

      <MasonryList
        data={visible}
        keyExtractor={(item, idx) => item.id || idx.toString()}
        renderItem={renderBookmark}
        numColumns={numCols}
        contentContainerStyle={{
          paddingHorizontal: PADDING,
          paddingTop: GAP,
          paddingBottom: GAP,
        }}
        innerRef={null}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: colors.label, textAlign: 'center', marginTop: 40, fontFamily: 'Quicksand_400Regular' }}>
              No bookmarks yet
            </Text>
          ) : null
        }
      />

      {/* Settings modal */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSettingsVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>

              {user?.email && (
                <Text style={[styles.modalEmail, { color: colors.label }]}>
                  {user.email}
                </Text>
              )}

              <Text style={[styles.modalSectionLabel, { color: colors.label }]}>Theme</Text>

              <View style={styles.swatchRow}>
                {Object.entries(THEME_SWATCHES).map(([key, swatch]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => { setThemeName(key); setSettingsVisible(false); }}
                    style={styles.swatchWrapper}
                  >
                    <View style={[
                      styles.swatch,
                      { backgroundColor: swatch.color, borderColor: swatch.border },
                      themeName === key && styles.swatchActive,
                    ]} />
                    <Text style={[
                      styles.swatchLabel,
                      { color: colors.label },
                      themeName === key && { color: colors.text, fontFamily: 'Quicksand_600SemiBold' },
                    ]}>
                      {swatch.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />

              <TouchableOpacity
                style={styles.modalAction}
                onPress={() => { reloadAll(); setSettingsVisible(false); }}
              >
                <Ionicons name="refresh-outline" size={18} color={colors.label} style={{ marginRight: 10 }} />
                <Text style={[styles.modalActionText, { color: colors.label }]}>Reload Data</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalAction}
                onPress={() => { setSettingsVisible(false); updateMissingDimensions(); }}
                disabled={updatingDimensions}
              >
                <Ionicons name="image-outline" size={18} color={colors.label} style={{ marginRight: 10 }} />
                <Text style={[styles.modalActionText, { color: colors.label }]}>
                  {updatingDimensions ? 'Updating...' : 'Fix Image Dimensions'}
                </Text>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: colors.inputBorder }]} />

              <TouchableOpacity
                style={styles.modalAction}
                onPress={() => { signOut(); setSettingsVisible(false); }}
              >
                <Ionicons name="log-out-outline" size={18} color="#d72660" style={{ marginRight: 10 }} />
                <Text style={[styles.modalActionText, { color: '#d72660' }]}>Sign Out</Text>
              </TouchableOpacity>

            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
    margin: 4,
  },
  cardTitle: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    fontSize: 13,
    fontFamily: 'Quicksand_500Medium',
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    borderRadius: 20,
    padding: 24,
    width: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalEmail: {
    fontSize: 13,
    fontFamily: 'Quicksand_400Regular',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontFamily: 'Quicksand_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  swatchWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  swatchActive: {
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ scale: 1.15 }],
  },
  swatchLabel: {
    fontSize: 10,
    fontFamily: 'Quicksand_400Regular',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalActionText: {
    fontSize: 15,
    fontFamily: 'Quicksand_500Medium',
  },
})