import React, { useState, useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, TextInput, Text, Image, StyleSheet, ScrollView,
  TouchableOpacity, Modal, FlatList, Alert, Platform, KeyboardAvoidingView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BookmarksContext } from '../context/BookmarksContext';
import { useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../ThemeContext';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'https://bookitweb.netlify.app/.netlify/functions';
const STORAGE_BUCKET = 'bookmark-images';

const windowWidth = Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth : 0;

// ── Multi-folder picker ──────────────────────────────────────────────────────
function MultiFolderPicker({ selectedIds, folders, onChange, colors }) {
  const [visible, setVisible] = useState(false);

  const toggleFolder = (id) =>
    onChange(selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id]);

  const label =
    selectedIds.length === 0 ? 'None selected' :
    selectedIds.length === 1 ? folders.find(f => f.id === selectedIds[0])?.name || '1 folder' :
    `${selectedIds.length} folders selected`;

  return (
    <View>
      <TouchableOpacity
        style={[styles.pickerTrigger, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.pickerTriggerText, { color: selectedIds.length ? colors.text : colors.label, fontFamily: 'Quicksand_400Regular' }]}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.label} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          onPress={() => setVisible(false)}
          activeOpacity={1}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Folders</Text>
              <FlatList
                data={folders}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.pickerRow, { borderBottomColor: colors.inputBorder }]}
                      onPress={() => toggleFolder(item.id)}
                    >
                      <View style={[
                        styles.checkbox,
                        { borderColor: colors.actionButton },
                        isSelected && { backgroundColor: colors.actionButton },
                      ]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color={colors.actionButtonText} />}
                      </View>
                      <Text style={[styles.pickerRowText, { color: colors.text }]}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
              <TouchableOpacity
                style={[styles.pickerDone, { backgroundColor: colors.actionButton }]}
                onPress={() => setVisible(false)}
              >
                <Text style={[styles.pickerDoneText, { color: colors.actionButtonText }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Shared form content ──────────────────────────────────────────────────────
function BookmarkForm({
  preview, setPreview, localImage, pickImage,
  tags, tagInput, handleTagInput, removeTag,
  selectedFolders, setSelectedFolders, checkDuplicate,
  duplicateWarning, saveBookmark, url, colors, folders,
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.formContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <Text style={[styles.fieldLabel, { color: colors.label }]}>Title</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder, fontFamily: 'Quicksand_400Regular' }]}
        value={preview.title}
        onChangeText={(text) => setPreview({ ...preview, title: text })}
        placeholder="Bookmark title"
        placeholderTextColor={colors.label}
      />

      {duplicateWarning && (
        <Text style={styles.duplicateWarning}>{duplicateWarning}</Text>
      )}

      {/* Image — mobile only (web handles this in the left column) */}
      {Platform.OS !== 'web' && (
        (preview.image || localImage) ? (
          <TouchableOpacity onPress={pickImage} style={styles.imageWrapper}>
            <Image source={{ uri: localImage || preview.image }} style={styles.previewImage} />
            <View style={styles.imageOverlay}>
              <Ionicons name="camera-outline" size={22} color="#fff" />
              <Text style={styles.imageOverlayText}>Change image</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.imagePlaceholder, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
            onPress={pickImage}
          >
            <Ionicons name="image-outline" size={28} color={colors.label} />
            <Text style={[styles.imagePlaceholderText, { color: colors.label }]}>Upload image</Text>
          </TouchableOpacity>
        )
      )}

      {/* Tags */}
      <Text style={[styles.fieldLabel, { color: colors.label }]}>Tags</Text>
      <View style={[styles.tagsContainer, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
        {tags.map((tag, idx) => (
          <View key={idx} style={[styles.tagBubble, { backgroundColor: colors.tag }]}>
            <Text style={[styles.tagText, { color: colors.text, fontFamily: 'Quicksand_500Medium' }]}>{tag}</Text>
            <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Ionicons name="close" size={13} color={colors.label} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        ))}
        <TextInput
          style={[styles.tagInput, { color: colors.text, fontFamily: 'Quicksand_400Regular' }]}
          value={tagInput}
          onChangeText={handleTagInput}
          placeholder={tags.length === 0 ? 'Type a tag and press space…' : 'Add another…'}
          placeholderTextColor={colors.label}
          autoCapitalize="none"
        />
      </View>

      {/* Folders */}
      <Text style={[styles.fieldLabel, { color: colors.label }]}>Folders</Text>
      <MultiFolderPicker
        selectedIds={selectedFolders}
        folders={folders}
        onChange={(ids) => {
          setSelectedFolders(ids);
          if (preview.url || url) checkDuplicate(preview.url || url);
        }}
        colors={colors}
      />

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.actionButton }]}
        onPress={saveBookmark}
        disabled={!preview.url && !url}
      >
        <Text style={[styles.saveButtonText, { color: colors.actionButtonText }]}>Save Bookmark</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function AddScreen({ navigation }) {
  const { addBookmark, folders, bookmarks } = useContext(BookmarksContext);
  const { colors } = useContext(ThemeContext);

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState({ title: '', image: null, url: '' });
  const [imageDimensions, setImageDimensions] = useState({ width: null, height: null });
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [localImage, setLocalImage] = useState(null);
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [previewError, setPreviewError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      setUrl('');
      setLoading(false);
      setPreview({ title: '', image: null, url: '' });
      setImageDimensions({ width: null, height: null });
      setTags([]);
      setTagInput('');
      setLocalImage(null);
      setSelectedFolders([]);
      setPreviewError('');
      setDuplicateWarning(null);
    }, [])
  );

  const fetchPreview = async () => {
    if (!url) return;
    setLoading(true);
    setPreviewError('');
    try {
      const res = await fetch(`${API_BASE}/fetch-metadata?url=${encodeURIComponent(url)}`);
      if (res.status === 429) {
        setPreviewError('Too many requests. Please wait and try again.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!data.title && !data.image) {
        setPreviewError('Unable to fetch preview for this URL.');
        setPreview({ title: '', image: null, url });
      } else {
        const imageUrl = data.image || null;
        setPreview({ title: data.title || '', image: imageUrl, url });
        if (imageUrl) {
          Image.getSize(
            imageUrl,
            (width, height) => setImageDimensions({ width, height }),
            () => setImageDimensions({ width: null, height: null })
          );
        } else {
          setImageDimensions({ width: null, height: null });
        }
        checkDuplicate(url);
      }
    } catch (err) {
      setPreviewError('Unable to fetch preview for this URL.');
      setPreview({ title: '', image: null, url });
    }
    setLoading(false);
  };

  const uploadImageIfNeeded = async (uri) => {
    if (!uri) return { imageUrl: null, imagePath: null };

    try {
      const response = await fetch(uri);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();

      const contentType = blob.type || 'image/jpeg';
      const ext = contentType.split('/')[1]?.split('+')[0] || 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, blob, { contentType, upsert: true });

      if (uploadError) {
        return { imageUrl: uri, imagePath: null };
      }

      return { imageUrl: null, imagePath: filePath };
    } catch (err) {
      return { imageUrl: uri, imagePath: null };
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.cancelled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setLocalImage(asset.uri);
      if (asset.width && asset.height) {
        setImageDimensions({ width: asset.width, height: asset.height });
      } else {
        Image.getSize(asset.uri,
          (w, h) => setImageDimensions({ width: w, height: h }),
          () => setImageDimensions({ width: null, height: null })
        );
      }
    }
  };

  const saveBookmark = async () => {
    const finalUrl = (preview.url || url || '').trim();
    if (!finalUrl) return;
    if (finalUrl.length > 2048) { Alert.alert('Error', 'URL is too long.'); return; }
    if ((preview.title || '').length > 300) { Alert.alert('Error', 'Title is too long (max 300 characters).'); return; }
    if (tags.some(t => t.length > 32)) { Alert.alert('Error', 'Tags must be 32 characters or less.'); return; }
    if (tags.length > 10) { Alert.alert('Error', 'You can add up to 10 tags per bookmark.'); return; }

    const originalImage = localImage || preview.image || null;
    const uploadResult = await uploadImageIfNeeded(originalImage);
    if (originalImage && !uploadResult) return;

    await addBookmark({
      title: (preview.title || '').trim(),
      url: finalUrl,
      image: uploadResult?.imageUrl || null,
      imagePath: uploadResult?.imagePath || null,
      imageWidth: imageDimensions.width,
      imageHeight: imageDimensions.height,
      tags: normalizeTags(tags),
      folderIds: selectedFolders,
    });
    navigation.goBack();
  };

  const handleTagInput = (text) => {
    if (text.endsWith(' ')) {
      const newTag = text.trim();
      if (newTag && !tags.includes(newTag)) setTags([...tags, newTag]);
      setTagInput('');
    } else {
      setTagInput(text);
    }
  };

  const removeTag = (tag) => setTags(tags.filter(t => t !== tag));

  const checkDuplicate = (checkUrl) => {
    const existing = bookmarks.find(b => b.url === checkUrl);
    if (existing) {
      const folderIds = existing.folder_ids || (existing.folder_id ? [existing.folder_id] : []);
      if (folderIds.length === 0) setDuplicateWarning('Already saved in Home');
      else if (folderIds.length === 1) setDuplicateWarning(`Already saved in "${folders.find(f => f.id === folderIds[0])?.name || 'a folder'}"`);
      else setDuplicateWarning(`Already saved in ${folderIds.length} folders`);
    } else {
      setDuplicateWarning(null);
    }
  };

  function normalizeTags(input) {
    return Array.from(new Set(
      (Array.isArray(input) ? input : input.split(','))
        .map(t => t.trim().toLowerCase())
        .filter(t => t && t.length <= 32)
    ));
  }

  const formProps = {
    preview, setPreview, localImage, pickImage,
    tags, tagInput, handleTagInput, removeTag,
    selectedFolders, setSelectedFolders, checkDuplicate,
    duplicateWarning, saveBookmark, url, colors, folders,
  };

  // ── URL entry state (no preview yet) ──
  if (!preview.url) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.urlScreen}>
          <View style={[
            styles.urlCard,
            { backgroundColor: colors.card },
            Platform.OS === 'web' && styles.urlCardWeb,
          ]}>
            <Text style={[styles.urlHeading, { color: colors.text }]}>Add a bookmark</Text>
            <Text style={[styles.urlSubheading, { color: colors.label }]}>Paste a URL to get started</Text>

            <TextInput
              style={[styles.urlInput, {
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.inputBorder,
                fontFamily: 'Quicksand_400Regular',
              }]}
              value={url}
              onChangeText={setUrl}
              onBlur={() => { if (url) checkDuplicate(url); }}
              onSubmitEditing={fetchPreview}
              placeholder="https://example.com"
              placeholderTextColor={colors.label}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
            />

            {duplicateWarning && (
              <Text style={styles.duplicateWarning}>{duplicateWarning}</Text>
            )}

            <TouchableOpacity
              style={[styles.fetchButton, { backgroundColor: colors.actionButton, opacity: url ? 1 : 0.5 }]}
              onPress={fetchPreview}
              disabled={!url || loading}
            >
              {loading
                ? <Text style={[styles.fetchButtonText, { color: colors.actionButtonText }]}>Fetching…</Text>
                : <>
                    <Ionicons name="search-outline" size={18} color={colors.actionButtonText} style={{ marginRight: 8 }} />
                    <Text style={[styles.fetchButtonText, { color: colors.actionButtonText }]}>Fetch Preview</Text>
                  </>
              }
            </TouchableOpacity>

            {previewError ? (
              <Text style={[styles.errorText, { color: colors.label }]}>{previewError}</Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Preview + form state ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {Platform.OS === 'web' && windowWidth >= 700 ? (
          // Web: two-column layout
          <View style={styles.webLayout}>
            {/* Left: image preview */}
            <View style={styles.webLeft}>
              {(preview.image || localImage) ? (
                <TouchableOpacity onPress={pickImage} style={styles.webImageWrapper}>
                  <img
                    src={localImage || preview.image}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }}
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.webImagePlaceholder, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                  onPress={pickImage}
                >
                  <Ionicons name="image-outline" size={40} color={colors.label} />
                  <Text style={[styles.imagePlaceholderText, { color: colors.label, marginTop: 10 }]}>Click to upload image</Text>
                </TouchableOpacity>
              )}
              {(preview.image || localImage) && (
                <TouchableOpacity
                  style={[styles.changeImageBtn, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                  onPress={pickImage}
                >
                  <Ionicons name="camera-outline" size={16} color={colors.label} />
                  <Text style={[styles.changeImageText, { color: colors.label }]}>Change image</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Right: form */}
            <View style={[styles.webRight, { backgroundColor: colors.card }]}>
              <BookmarkForm {...formProps} />
            </View>
          </View>
        ) : (
          // Mobile: single column
          <View style={[styles.mobileForm, { backgroundColor: colors.card }]}>
            <BookmarkForm {...formProps} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  urlScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  urlCard: {
    width: '100%',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  urlCardWeb: {
    maxWidth: 520,
  },
  urlHeading: {
    fontSize: 22,
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 6,
  },
  urlSubheading: {
    fontSize: 14,
    fontFamily: 'Quicksand_400Regular',
    marginBottom: 24,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    marginBottom: 8,
  },
  fetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  fetchButtonText: {
    fontSize: 16,
    fontFamily: 'Quicksand_600SemiBold',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Quicksand_400Regular',
    marginTop: 12,
    textAlign: 'center',
  },
  webLayout: {
    flex: 1,
    flexDirection: 'row',
    padding: 24,
    gap: 24,
  },
  webLeft: {
    flex: 1,
    maxWidth: 480,
  },
  webImageWrapper: {
    flex: 1,
    minHeight: 300,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  webImagePlaceholder: {
    flex: 1,
    minHeight: 300,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  changeImageText: {
    fontSize: 13,
    fontFamily: 'Quicksand_500Medium',
  },
  webRight: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mobileForm: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  formContent: {
    padding: 20,
    paddingBottom: 40,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Quicksand_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  duplicateWarning: {
    color: '#ef4444',
    fontSize: 12,
    fontFamily: 'Quicksand_400Regular',
    marginTop: 6,
    marginBottom: 4,
  },
  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    height: 180,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Quicksand_500Medium',
  },
  imagePlaceholder: {
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 13,
    fontFamily: 'Quicksand_400Regular',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 6,
    minHeight: 46,
  },
  tagBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 13,
  },
  tagInput: {
    fontSize: 14,
    minWidth: 100,
    paddingVertical: 2,
    flex: 1,
  },
  saveButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Quicksand_600SemiBold',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  pickerTriggerText: {
    fontSize: 14,
    flex: 1,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    borderRadius: 16,
    padding: 20,
    width: 300,
    maxHeight: 420,
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 14,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pickerRowText: {
    fontSize: 15,
    fontFamily: 'Quicksand_400Regular',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerDone: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickerDoneText: {
    fontSize: 15,
    fontFamily: 'Quicksand_600SemiBold',
  },
});