// screens/HomeScreen.js
import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Image, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MasonryList from '@react-native-seoul/masonry-list';
import { AuthContext } from '../context/AuthContext';
import { BookmarksContext } from '../context/BookmarksContext';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../ThemeContext';
import { filterBookmarksByQuery } from '../utils/searchBookmarks';

const GAP = 8;
const API_BASE = 'https://bookitweb.netlify.app/.netlify/functions';

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

// Runs `fn` over `items` with at most `limit` in flight at once.
async function mapWithConcurrency(items, limit, fn) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export default function HomeScreen({ navigation }) {
  const { signOut, user } = useContext(AuthContext);
  const { themeName, colors, setThemeName } = useContext(ThemeContext);
  const { bookmarks = [], folders = [], loading, reloadAll, updateBookmark, updateBookmarkTags } = useContext(BookmarksContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [updatingDimensions, setUpdatingDimensions] = useState(false);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [tagProgress, setTagProgress] = useState({ done: 0, total: 0 });
  const failedTagBookmarksRef = useRef([]);
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

const hasShuffled = useRef(false);

useEffect(() => {
  if (bookmarks.length === 0) {
    hasShuffled.current = false;
    setShuffledLocal([]);
    setFilteredBookmarks([]);
    return;
  }

  if (!hasShuffled.current) {
    // First load — shuffle everything
    const shuffled = shuffleArray(bookmarks);
    setShuffledLocal(shuffled);
    setFilteredBookmarks(shuffled);
    hasShuffled.current = true;
  } else {
    // Subsequent updates — prepend any new bookmarks to the front, and refresh
    // the data (tags, etc.) of ones already in the list so field-only changes
    // like a batch tag update show up without needing a full app reload.
    const byId = new Map(bookmarks.map(b => [b.id, b]));
    const existingIds = new Set(shuffledLocal.map(b => b.id));
    const newOnes = bookmarks.filter(b => !existingIds.has(b.id));
    setShuffledLocal(prev => [
      ...newOnes,
      ...prev.filter(b => byId.has(b.id)).map(b => byId.get(b.id)),
    ]);
  }
}, [bookmarks]);

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setFilteredBookmarks(filterBookmarksByQuery(shuffledLocal, searchQuery));
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
            } catch {}
            resolve();
          };
          img.onerror = () => resolve();
          img.src = bookmark.image;
        });
      } catch {}
    }
    setUpdatingDimensions(false);
    alert(`Updated ${updated} of ${missingDims.length} bookmarks!`);
    await reloadAll();
  };

  const suggestTagsForUntagged = async () => {
    const untagged = bookmarks.filter(b => !b.tags || b.tags.length === 0);
    if (untagged.length === 0) { alert('No untagged bookmarks found!'); return; }
    const confirmed = confirm(`Suggest tags for ${untagged.length} untagged bookmark${untagged.length === 1 ? '' : 's'}? This calls Claude once per bookmark.`);
    if (!confirmed) return;

    setSuggestingTags(true);
    setTagProgress({ done: 0, total: untagged.length });
    failedTagBookmarksRef.current = [];

    // Reuse the user's most common existing tags as vocabulary hints,
    // so the model prefers them over inventing near-duplicates.
    const tagCounts = {};
    bookmarks.forEach(b => (b.tags || []).forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }));
    const existingTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([t]) => t);

    let succeeded = 0;
    let failed = 0;

    await mapWithConcurrency(untagged, 8, async (bookmark) => {
      try {
        const folderIds = bookmark.folder_ids?.length > 0
          ? bookmark.folder_ids
          : (bookmark.folder_id ? [bookmark.folder_id] : []);
        const folderName = folderIds.length > 0
          ? folders.find(f => f.id === folderIds[0])?.name || null
          : null;

        const response = await fetch(`${API_BASE}/suggest-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: bookmark.title,
            url: bookmark.url,
            existingTags,
            folderName,
          }),
        });
        if (!response.ok) {
          let serverMessage = '';
          try { serverMessage = (await response.json()).error; } catch {}
          throw new Error(serverMessage || `HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.tags && data.tags.length > 0) {
          await updateBookmarkTags(bookmark.id, data.tags);
          succeeded++;
        } else {
          failed++;
          failedTagBookmarksRef.current.push({ id: bookmark.id, title: bookmark.title, url: bookmark.url, reason: 'no tags returned' });
        }
      } catch (err) {
        failed++;
        failedTagBookmarksRef.current.push({ id: bookmark.id, title: bookmark.title, url: bookmark.url, reason: err.message });
      } finally {
        setTagProgress(p => ({ ...p, done: p.done + 1 }));
      }
    });

    setSuggestingTags(false);
    if (failedTagBookmarksRef.current.length > 0) {
      console.warn('Bookmarks that failed tag suggestion:', failedTagBookmarksRef.current);
    }
    const failedList = failedTagBookmarksRef.current
      .slice(0, 10)
      .map(b => `- ${b.title || b.url}`)
      .join('\n');
    const moreCount = failedTagBookmarksRef.current.length - 10;
    alert(
      `Tagged ${succeeded} of ${untagged.length} bookmarks${failed > 0 ? ` (${failed} failed)` : ''}.` +
      (failed > 0 ? `\n\nFailed:\n${failedList}${moreCount > 0 ? `\n...and ${moreCount} more (see console log)` : ''}` : '')
    );
    await reloadAll();
  };

  const visible = (filteredBookmarks || []).filter(b => {
    const folderIds = b.folder_ids?.length > 0 ? b.folder_ids : (b.folder_id ? [b.folder_id] : []);
    if (folderIds.length === 0) return true;
    // Only hide from Home when EVERY folder this bookmark belongs to is hidden —
    // a bookmark cross-filed into at least one visible folder still shows.
    const allHidden = folderIds.every(fid => folders.find(f => f.id === fid)?.hidden);
    return !allHidden;
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

              <TouchableOpacity
                style={styles.modalAction}
                onPress={() => { setSettingsVisible(false); suggestTagsForUntagged(); }}
                disabled={suggestingTags}
              >
                <Ionicons name="pricetags-outline" size={18} color={colors.label} style={{ marginRight: 10 }} />
                <Text style={[styles.modalActionText, { color: colors.label }]}>
                  {suggestingTags ? 'Suggesting tags...' : 'Suggest Tags for Untagged Bookmarks'}
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

      {suggestingTags && (
        <View style={[styles.progressBanner, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <ActivityIndicator color={colors.label} style={{ marginRight: 10 }} />
          <Text style={[styles.progressBannerText, { color: colors.text }]}>
            Suggesting tags... {tagProgress.done}/{tagProgress.total}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  progressBanner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  progressBannerText: {
    fontSize: 14,
    fontFamily: 'Quicksand_500Medium',
  },
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