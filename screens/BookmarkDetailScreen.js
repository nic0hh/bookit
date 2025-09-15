// screens/BookmarkDetailScreen.js
import React, { useContext, useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { BookmarksContext } from '../context/BookmarksContext';
import { ThemeContext } from '../ThemeContext';

export default function BookmarkDetailScreen({ route, navigation }) {
  const { colors } = useContext(ThemeContext);
  const { updateBookmark, deleteBookmark, folders } = useContext(BookmarksContext);

  const bookmark = route.params?.bookmark;

  const [title, setTitle] = useState(bookmark?.title || '');
  const [url, setUrl] = useState(bookmark?.url || '');
  const [tagsStr, setTagsStr] = useState((bookmark?.tags || []).join(', '));
  const [selectedFolder, setSelectedFolder] = useState(bookmark?.folderId || null);
  const [imageUri, setImageUri] = useState(bookmark?.image || null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const changed = useMemo(() => {
    const newTags = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const originalTags = (bookmark?.tags || []).map(t => t.trim());
    const sameTags =
      newTags.length === originalTags.length &&
      newTags.every((t, i) => t === originalTags[i]);
    return (
      title !== (bookmark?.title || '') ||
      url !== (bookmark?.url || '') ||
      !sameTags ||
      selectedFolder !== (bookmark?.folderId || null) ||
      imageUri !== (bookmark?.image || null)
    );
  }, [title, url, tagsStr, selectedFolder, imageUri, bookmark]);

  const onSave = async () => {
    if (!bookmark || !changed) return;

    if (url.length > 2048) {
      Alert.alert('Error', 'URL is too long.');
      return;
    }
    if ((title || '').length > 300) {
      Alert.alert('Error', 'Title is too long (max 300 characters).');
      return;
    }
    const newTags = normalizeTags(tagsStr);
    if (newTags.some(tag => tag.length > 32)) {
      Alert.alert('Error', 'Tags must be 32 characters or less.');
      return;
    }
    if (newTags.length > 10) {
      Alert.alert('Error', 'You can add up to 10 tags per bookmark.');
      return;
    }

    setSaving(true);
    const err = await updateBookmark(bookmark.id, {
      title: title.trim(),
      url: url.trim(),
      tags: newTags,
      folderId: selectedFolder || null,
      image: imageUri || null,
    });
    setSaving(false);
    if (err) Alert.alert('Error', err);
    else navigation.goBack();
  };

  const confirmDelete = () => {
    Alert.alert('Delete Bookmark', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          await deleteBookmark(bookmark.id);
          setRemoving(false);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ color: colors.text, fontFamily: 'Quicksand', fontSize: 18, marginBottom: 12 }}>
        Edit Bookmark
      </Text>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={colors.label}
        style={{
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 14,
          padding: 12,
          marginBottom: 12,
          color: colors.text,
          fontFamily: 'Quicksand',
        }}
      />

      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="URL"
        autoCapitalize="none"
        keyboardType="url"
        placeholderTextColor={colors.label}
        style={{
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 14,
          padding: 12,
          marginBottom: 12,
          color: colors.text,
          fontFamily: 'Quicksand',
        }}
      />

      <TextInput
        value={tagsStr}
        onChangeText={setTagsStr}
        placeholder="Tags (comma separated)"
        placeholderTextColor={colors.label}
        style={{
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 14,
          padding: 12,
          marginBottom: 12,
          color: colors.text,
          fontFamily: 'Quicksand',
        }}
      />

      <Text style={{ color: colors.label, fontFamily: 'Quicksand', fontSize: 14, marginBottom: 6 }}>
        Folder
      </Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 14,
          padding: 10,
          marginBottom: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            // Optionally open a modal picker if you converted earlier
            // For now cycle through: None -> first -> next
            const list = [null, ...folders.map(f => f.id)];
            const idx = list.indexOf(selectedFolder);
            const next = list[(idx + 1) % list.length];
            setSelectedFolder(next);
          }}
        >
          <Text style={{ color: colors.text, fontFamily: 'Quicksand' }}>
            {selectedFolder
              ? folders.find(f => f.id === selectedFolder)?.name || 'Folder'
              : 'None (tap to change)'}
          </Text>
        </TouchableOpacity>
      </View>

      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: '100%', height: 160, borderRadius: 12, marginBottom: 16 }}
          resizeMode="cover"
        />
      ) : null}

      <TouchableOpacity
        disabled={!changed || saving}
        onPress={onSave}
        style={{
          backgroundColor: changed ? colors.button : colors.inputBackground,
          paddingVertical: 14,
          borderRadius: 16,
          alignItems: 'center',
          marginBottom: 16,
          opacity: saving ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            color: colors.buttonText,
            fontFamily: 'Quicksand',
            fontSize: 16,
            fontWeight: 'bold',
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        disabled={removing}
        onPress={confirmDelete}
        style={{
          backgroundColor: '#d72660',
          paddingVertical: 14,
          borderRadius: 16,
          alignItems: 'center',
          opacity: removing ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontFamily: 'Quicksand',
            fontSize: 16,
            fontWeight: 'bold',
          }}
        >
          {removing ? 'Deleting...' : 'Delete Bookmark'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function normalizeTags(tags) {
  return Array.from(
    new Set(
      (Array.isArray(tags) ? tags : tags.split(','))
        .map(t => t.trim())
        .filter(t => t && t.length <= 32)
    )
  );
}

