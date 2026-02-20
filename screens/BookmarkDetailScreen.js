// screens/BookmarkDetailScreen.js
import React, { useState, useContext, useLayoutEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, Image, StyleSheet, ScrollView,
  TouchableOpacity, Modal, FlatList, Alert, Platform,
  KeyboardAvoidingView, Linking
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { BookmarksContext } from '../context/BookmarksContext';
import { ThemeContext } from '../ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';

const STORAGE_BUCKET = 'bookmark-images';
const API_BASE = 'https://bookitweb.netlify.app/.netlify/functions';

// ── Shared folder picker (same pattern as AddScreen) ─────────────────────────
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
        <TouchableOpacity style={styles.pickerOverlay} onPress={() => setVisible(false)} activeOpacity={1}>
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
                      <View style={[styles.checkbox, { borderColor: colors.actionButton }, isSelected && { backgroundColor: colors.actionButton }]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color={colors.actionButtonText} />}
                      </View>
                      <Text style={[styles.pickerRowText, { color: colors.text }]}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
              <TouchableOpacity style={[styles.pickerDone, { backgroundColor: colors.actionButton }]} onPress={() => setVisible(false)}>
                <Text style={[styles.pickerDoneText, { color: colors.actionButtonText }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BookmarkDetailScreen({ navigation, route }) {
  const { updateBookmark, deleteBookmark, folders } = useContext(BookmarksContext);
  const { colors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();

  const bookmark = route.params?.bookmark || {};

  const [title, setTitle] = useState(bookmark?.title || '');
  const [url, setUrl] = useState(bookmark?.url || '');
  const [tags, setTags] = useState(bookmark?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [imageUri, setImageUri] = useState(bookmark?.image || null);
  const [imageDimensions, setImageDimensions] = useState({
    width: bookmark?.image_width || null,
    height: bookmark?.image_height || null,
  });
  const [imagePath, setImagePath] = useState(bookmark?.image_path || null);
  const [selectedFolders, setSelectedFolders] = useState(
    bookmark?.folder_ids || (bookmark?.folder_id ? [bookmark.folder_id] : [])
  );
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Edit Bookmark',
      headerTitleStyle: { fontFamily: 'Quicksand_600SemiBold', fontSize: 17, color: colors.text },
      headerStyle: { backgroundColor: colors.background },
      headerLeft: () => (
        <TouchableOpacity style={{ paddingHorizontal: 16 }} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const isRemoteUrl = (uri) => /^https?:\/\//i.test(uri);

  const uploadImageIfNeeded = async (uri) => {
    if (!uri || isRemoteUrl(uri)) return null;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext) ? ext : 'jpg';
      const contentType = safeExt === 'jpg' ? 'image/jpeg' : `image/${safeExt}`;
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
      const filePath = `uploads/${fileName}`;
      const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, blob, { contentType, upsert: true });
      if (uploadError) { Alert.alert('Upload failed', 'Could not upload the selected image.'); return null; }
      return filePath;
    } catch (err) {
      Alert.alert('Upload failed', 'Could not upload the selected image.');
      return null;
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImagePath(null);
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

  const refreshMetadata = async () => {
    if (!url?.trim()) { Alert.alert('Error', 'Please enter a URL first'); return; }
    setRefreshingMetadata(true);
    try {
      const response = await fetch(`${API_BASE}/fetch-metadata?url=${encodeURIComponent(url.trim())}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) { Alert.alert('Error', data.error); return; }
      let updated = false;
      if (data.title) { setTitle(data.title); updated = true; }
      if (data.image) { setImageUri(data.image); setImagePath(null); updated = true; }
      Alert.alert(updated ? 'Done' : 'No changes', updated ? 'Metadata refreshed. Save to apply.' : 'No new metadata found.');
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch metadata.');
    } finally {
      setRefreshingMetadata(false);
    }
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

  const normalizeTags = (input) =>
    Array.from(new Set(input.map(t => t.trim().toLowerCase()).filter(t => t && t.length <= 32)));

  const onSave = async () => {
    if (url.length > 2048) { Alert.alert('Error', 'URL is too long.'); return; }
    if (title.length > 300) { Alert.alert('Error', 'Title is too long.'); return; }
    if (tags.length > 10) { Alert.alert('Error', 'Max 10 tags.'); return; }

    setSaving(true);
    const originalImage = imageUri || null;
    let imageUrlToSave = null;
    let imagePathToSave = imagePath || null;

    if (originalImage && !isRemoteUrl(originalImage)) {
      const uploadResult = await uploadImageIfNeeded(originalImage);
      if (!uploadResult) { setSaving(false); return; }
      imagePathToSave = uploadResult;
      imageUrlToSave = null;
    } else if (!imagePathToSave) {
      imageUrlToSave = originalImage || null;
      imagePathToSave = null;
    }

    if (originalImage && !imageUrlToSave && !imagePathToSave) { setSaving(false); return; }

    const err = await updateBookmark(bookmark.id, {
      title: title.trim(), url: url.trim(),
      tags: normalizeTags(tags), folderIds: selectedFolders,
      image: imageUrlToSave, imagePath: imagePathToSave,
      imageWidth: imageDimensions.width ?? bookmark?.image_width ?? null,
      imageHeight: imageDimensions.height ?? bookmark?.image_height ?? null,
    });
    setSaving(false);
    if (err) Alert.alert('Error', err);
    else navigation.goBack();
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this bookmark?')) {
        (async () => {
          setRemoving(true);
          const result = await deleteBookmark(bookmark.id);
          setRemoving(false);
          if (!result) navigation.goBack();
          else alert('Failed to delete: ' + (result.error || result));
        })();
      }
      return;
    }
    Alert.alert('Delete Bookmark', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setRemoving(true);
        const result = await deleteBookmark(bookmark.id);
        setRemoving(false);
        if (!result) navigation.goBack();
        else Alert.alert('Error', 'Failed to delete.');
      }},
    ]);
  };

  const copyUrl = () => {
    if (url) { Clipboard.setStringAsync(url); Alert.alert('Copied', 'URL copied to clipboard!'); }
  };

  const openUrl = async () => {
    if (!url) { Alert.alert('No URL', 'No URL on this bookmark.'); return; }
    if (url.startsWith('blob:')) { Alert.alert('Cannot open', 'Preview only available on web.'); return; }
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else Alert.alert('Cannot open', 'Cannot open this URL.');
    } catch { Alert.alert('Error', 'Failed to open URL.'); }
  };

  // ── Shared form content ──
  const FormContent = () => (
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
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={colors.label}
      />

      {/* URL */}
      <Text style={[styles.fieldLabel, { color: colors.label }]}>URL</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder, fontFamily: 'Quicksand_400Regular' }]}
        value={url}
        onChangeText={setUrl}
        placeholder="https://example.com"
        placeholderTextColor={colors.label}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* URL actions row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionChip, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
          onPress={copyUrl}
        >
          <Ionicons name="copy-outline" size={15} color={colors.label} />
          <Text style={[styles.actionChipText, { color: colors.label }]}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionChip, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
          onPress={openUrl}
        >
          <Ionicons name="open-outline" size={15} color={colors.label} />
          <Text style={[styles.actionChipText, { color: colors.label }]}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionChip, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, opacity: refreshingMetadata ? 0.5 : 1 }]}
          onPress={refreshMetadata}
          disabled={refreshingMetadata}
        >
          <Ionicons name="refresh-outline" size={15} color={colors.label} />
          <Text style={[styles.actionChipText, { color: colors.label }]}>
            {refreshingMetadata ? 'Refreshing…' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mobile-only image (web shows in left column) */}
      {Platform.OS !== 'web' && imageUri && (
        <TouchableOpacity onPress={pickImage} style={styles.mobileImageWrapper}>
          <Image
            source={{ uri: imageUri }}
            style={styles.mobileImage}
            resizeMode="cover"
          />
          <View style={styles.imageOverlay}>
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.imageOverlayText}>Change image</Text>
          </View>
        </TouchableOpacity>
      )}
      {Platform.OS !== 'web' && !imageUri && (
        <TouchableOpacity
          style={[styles.imagePlaceholder, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
          onPress={pickImage}
        >
          <Ionicons name="image-outline" size={28} color={colors.label} />
          <Text style={[styles.imagePlaceholderText, { color: colors.label }]}>Upload image</Text>
        </TouchableOpacity>
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
        onChange={setSelectedFolders}
        colors={colors}
      />

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.actionButton, opacity: saving ? 0.6 : 1 }]}
        onPress={onSave}
        disabled={saving}
      >
        <Ionicons name="checkmark-outline" size={18} color={colors.actionButtonText} style={{ marginRight: 8 }} />
        <Text style={[styles.saveButtonText, { color: colors.actionButtonText }]}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Text>
      </TouchableOpacity>

      {/* Delete */}
      <TouchableOpacity
        style={[styles.deleteButton, { opacity: removing ? 0.6 : 1 }]}
        onPress={confirmDelete}
        disabled={removing}
      >
        <Ionicons name="trash-outline" size={16} color="#d72660" style={{ marginRight: 6 }} />
        <Text style={styles.deleteButtonText}>
          {removing ? 'Deleting…' : 'Delete Bookmark'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {Platform.OS === 'web' ? (
          // Web: two-column layout matching AddScreen
          <View style={styles.webLayout}>
            {/* Left: image */}
            <View style={styles.webLeft}>
              {imageUri ? (
                <TouchableOpacity onPress={pickImage} style={styles.webImageWrapper}>
                  <img
                    src={imageUri}
                    alt={title || 'Bookmark'}
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
              {imageUri && (
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
              <FormContent />
            </View>
          </View>
        ) : (
          // Mobile: single column
          <View style={[styles.mobileForm, { backgroundColor: colors.card }]}>
            <FormContent />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Web layout ──
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

  // ── Mobile layout ──
  mobileForm: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  // ── Form ──
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

  // URL action chips
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionChipText: {
    fontSize: 13,
    fontFamily: 'Quicksand_500Medium',
  },

  // Mobile image
  mobileImageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 180,
    marginTop: 8,
  },
  mobileImage: {
    width: '100%',
    height: '100%',
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
    marginTop: 8,
  },
  imagePlaceholderText: {
    fontSize: 13,
    fontFamily: 'Quicksand_400Regular',
  },

  // Tags
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
  tagText: { fontSize: 13 },
  tagInput: {
    fontSize: 14,
    minWidth: 100,
    paddingVertical: 2,
    flex: 1,
  },

  // Buttons
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 24,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Quicksand_600SemiBold',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 10,
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: 'Quicksand_500Medium',
    color: '#d72660',
  },

  // Folder picker
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  pickerTriggerText: { fontSize: 14, flex: 1 },
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
  pickerRowText: { fontSize: 15, fontFamily: 'Quicksand_400Regular', flex: 1 },
  checkbox: {
    width: 22, height: 22,
    borderRadius: 6, borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  pickerDone: { marginTop: 14, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  pickerDoneText: { fontSize: 15, fontFamily: 'Quicksand_600SemiBold' },
});