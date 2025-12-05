// screens/BookmarkDetailScreen.js
import React, { useState, useContext, useLayoutEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, Image, StyleSheet, ScrollView,
  TouchableOpacity, Modal, FlatList, Alert, Platform, KeyboardAvoidingView,
  Linking
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { BookmarksContext } from '../context/BookmarksContext';
import { ThemeContext } from '../ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function BookmarkDetailScreen({ navigation, route }) {
  const { updateBookmark, deleteBookmark, folders } = useContext(BookmarksContext);
  const { colors, setThemeName } = useContext(ThemeContext);

  const bookmark = route.params?.bookmark || {}; // adjust to your prop shape

  const [title, setTitle] = useState(bookmark?.title || '');
  const [url, setUrl] = useState(bookmark?.url || '');
  const [tags, setTags] = useState(bookmark?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [imageUri, setImageUri] = useState(bookmark?.image || null);
  const [selectedFolder, setSelectedFolder] = useState(bookmark?.folderId || null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);

  const insets = useSafeAreaInsets();

  const refreshMetadata = async () => {
    if (!url || url.trim().length === 0) {
      Alert.alert('Error', 'Please enter a URL first');
      return;
    }

    setRefreshingMetadata(true);
    try {
      console.log('Fetching metadata for:', url);
      
      // Use production Netlify function URL
      const functionUrl = `https://bookitweb.netlify.app/.netlify/functions/fetch-metadata?url=${encodeURIComponent(url.trim())}`;
      console.log('Calling function at:', functionUrl);
      
      const response = await fetch(functionUrl);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Metadata response:', data);
      
      if (data.error) {
        Alert.alert('Error', data.error);
        return;
      }

      // Update with new metadata
      let updated = false;
      if (data.title) {
        setTitle(data.title);
        updated = true;
      }
      if (data.image) {
        setImageUri(data.image);
        updated = true;
      }
      
      if (updated) {
        Alert.alert('Success', 'Metadata refreshed! Click Save to update.');
      } else {
        Alert.alert('Info', 'No new metadata found for this URL.');
      }
    } catch (err) {
      console.error('Refresh metadata error:', err);
      Alert.alert('Error', 'Failed to fetch metadata: ' + err.message);
    } finally {
      setRefreshingMetadata(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleTagInput = (text) => {
    if (text.endsWith(' ')) {
      const newTag = text.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    } else {
      setTagInput(text);
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const normalizeTags = (tags) =>
    Array.from(new Set(tags.map(t => t.trim().toLowerCase()).filter(t => t && t.length <= 32)));

  const onSave = async () => {
    if (url.length > 2048) {
      Alert.alert('Error', 'URL is too long.');
      return;
    }
    if (title.length > 300) {
      Alert.alert('Error', 'Title is too long (max 300 characters).');
      return;
    }
    if (tags.length > 10) {
      Alert.alert('Error', 'You can add up to 10 tags per bookmark.');
      return;
    }

    setSaving(true);
    const err = await updateBookmark(bookmark.id, {
      title: title.trim(),
      url: url.trim(),
      tags: normalizeTags(tags),
      folderId: selectedFolder || null,
      image: imageUri || null,
    });
    setSaving(false);

    if (err) Alert.alert('Error', err);
    else navigation.goBack();
  };

  const confirmDelete = () => {
    console.log('=== confirmDelete called ===');
    console.log('Platform:', Platform.OS);
    
    // On web, Alert.alert doesn't work properly, so just confirm with window.confirm
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to delete this bookmark?');
      console.log('Web confirm result:', confirmed);
      if (confirmed) {
        (async () => {
          setRemoving(true);
          console.log('Calling deleteBookmark for:', bookmark.id);
          const result = await deleteBookmark(bookmark.id);
          console.log('Delete result:', result);
          setRemoving(false);
          if (!result) {
            navigation.goBack();
          } else {
            alert('Failed to delete bookmark: ' + (result.error || result));
          }
        })();
      }
      return;
    }
    
    // Native Alert.alert for iOS/Android
    Alert.alert('Delete Bookmark', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          const result = await deleteBookmark(bookmark.id);
          setRemoving(false);
          if (!result) {
            navigation.goBack();
          } else {
            Alert.alert('Error', 'Failed to delete bookmark: ' + (result.error || result));
          }
        },
      },
    ]);
  };

  const copyUrl = () => {
    if (url) {
      Clipboard.setStringAsync(url);
      Alert.alert('Copied', 'URL copied to clipboard!');
    }
  };

  const openUrl = async () => {
    if (!url) {
      Alert.alert('No URL', 'This bookmark does not have a valid URL.');
      return;
    }

    // Block blob: URLs on native — they are web-only
    if (typeof url === 'string' && url.startsWith('blob:')) {
      Alert.alert('Cannot open', 'This preview is only available on web.');
      return;
    }

    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot open', 'Cannot open this URL on your device.');
      }
    } catch (e) {
      console.warn('openUrl error', e);
      Alert.alert('Error', 'Failed to open URL.');
    }
  };

  // 🔹 Folder picker copied from AddScreen
  const CustomPicker = ({ value, options, onChange }) => {
    const [visible, setVisible] = useState(false);
    const selectedLabel = options.find(opt => opt.value === value)?.label || 'None';

    return (
      <View>
        <TouchableOpacity
          style={{
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBackground,
            borderRadius: 15,
            padding: 12,
          }}
          onPress={() => setVisible(true)}
        >
          <Text style={{ color: colors.pickerText }}>{selectedLabel}</Text>
        </TouchableOpacity>
        <Modal visible={visible} transparent animationType="fade">
          <TouchableOpacity
            style={{
              flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'center', alignItems: 'center',
            }}
            onPress={() => setVisible(false)}
            activeOpacity={1}
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                minWidth: 220,
                maxHeight: 350,
              }}
            >
              <FlatList
                data={options}
                keyExtractor={item => String(item.value)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{
                      paddingVertical: 12, paddingHorizontal: 8,
                      borderBottomWidth: 1, borderBottomColor: colors.inputBorder,
                    }}
                    onPress={() => {
                      onChange(item.value);
                      setVisible(false);
                    }}
                  >
                    <Text style={{ color: colors.pickerText, fontSize: 17 }}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Edit Bookmark',
      headerTitleStyle: {
        color: colors.text, // 👈 theme color for title
        fontSize: 18,
      },
      headerStyle: {
        backgroundColor: colors.background, // optional: match theme background
      },
      headerLeft: () => (
        <TouchableOpacity
          style={{ paddingHorizontal: 16 }}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.text, colors.background]);

  async function handleDelete() {
    console.log('=== handleDelete called ===');
    console.log('bookmark?.id:', bookmark?.id);
    if (!bookmark?.id) {
      console.log('❌ No bookmark ID, returning');
      return;
    }
    
    console.log('Calling deleteBookmark...');
    const result = await deleteBookmark(bookmark.id);
    console.log('deleteBookmark returned:', result);
    console.log('Type of result:', typeof result);
    console.log('Truthy?', !!result);
    
    if (result) {
      console.warn('❌ deleteBookmark returned error', result);
      try { Alert.alert('Delete failed', String(result.error || result)); } catch {}
    } else {
      console.log('✅ delete succeeded, navigating back');
      navigation.goBack();
    }
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View
          style={{
            flex: 1,
            borderTopWidth: Platform.OS === 'web' ? 0 : 1,      // remove top border on web
            borderBottomWidth: Platform.OS === 'web' ? 0 : 1,   // remove bottom border on web
            borderColor: Platform.OS === 'web' ? 'transparent' : colors.bookmarkBorder, // remove border color on web
            backgroundColor: colors.card,
            ...(Platform.OS === 'web'
              ? {
                  maxWidth: 420,
                  maxHeight: 850,
                  alignSelf: 'center',
                  width: '100%',
                  borderRadius: 24,
                  overflow: 'hidden',
                  marginTop: 40,
                  marginBottom: 40,
                }
              : {}),
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title */}
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.inputBorder,
              }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.label}
            />

            {/* URL */}
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.inputBorder,
              }]}
              value={url}
              onChangeText={setUrl}
              placeholder="URL"
              placeholderTextColor={colors.label}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[
                styles.buttonGray,
                {
                  backgroundColor: colors.actionButton,
                  borderWidth: 0.7,
                  borderColor: colors.actionButtonText, // 👈 add border with actionButtonText color
                }
              ]}
              onPress={copyUrl}
            >
              <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                Copy URL
              </Text>
            </TouchableOpacity>

            {/* Image */}
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} />
            ) : null}
            
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                style={[
                  styles.buttonGray,
                  {
                    flex: 1,
                    backgroundColor: colors.actionButton,
                    borderWidth: 0.7,
                    borderColor: colors.actionButtonText,
                  }
                ]}
                onPress={pickImage}
              >
                <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                  Upload Image
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.buttonGray,
                  {
                    flex: 1,
                    backgroundColor: colors.actionButton,
                    borderWidth: 0.7,
                    borderColor: colors.actionButtonText,
                    opacity: refreshingMetadata ? 0.5 : 1,
                  }
                ]}
                onPress={refreshMetadata}
                disabled={refreshingMetadata}
              >
                <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                  {refreshingMetadata ? 'Refreshing...' : 'Refresh Metadata'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tags */}
            <Text style={[styles.label, { color: colors.label }]}>Tags (type and press space):</Text>
            <View style={[styles.tagsRow, { flexWrap: 'wrap', alignItems: 'flex-start' }]}>
              {tags.map((tag, idx) => (
                <View key={idx} style={[styles.tagBubble, { backgroundColor: colors.tag }]}>
                  <Text style={[styles.tagText, { color: colors.tagText }]}>{tag}</Text>
                  <Text
                    style={[styles.tagRemove, { color: colors.label }]}
                    onPress={() => removeTag(tag)}
                  >
                    ×
                  </Text>
                </View>
              ))}
              <TextInput
                style={[styles.tagInput, {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                  borderColor: colors.inputBorder,
                }]}
                value={tagInput}
                onChangeText={handleTagInput}
                placeholder="Add tag"
                placeholderTextColor={colors.label}
                autoCapitalize="none"
              />
            </View>

            {/* Folder */}
            <Text style={[styles.label, { color: colors.label }]}>Select Folder:</Text>
            <CustomPicker
              value={selectedFolder}
              options={[
                { label: 'None', value: null },
                ...folders.map(f => ({ label: f.name, value: String(f.id) })),
              ]}
              onChange={val => setSelectedFolder(val)}
            />

            {/* Save + Delete */}
            <TouchableOpacity
              style={[
                styles.buttonGray,
                {
                  backgroundColor: colors.actionButton,
                  borderWidth: 0.7,
                  borderColor: colors.actionButtonText,
                  marginTop: 12,
                  marginBottom: 8,
                }
              ]}
              onPress={onSave}
              disabled={saving}
            >
              <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>

            {/* Go to Site button */}
            <TouchableOpacity
              style={[
                styles.buttonGray,
                {
                  backgroundColor: colors.actionButton,         // match Save Changes button
                  borderWidth: 0.7,
                  borderColor: colors.actionButtonText,         // match Save Changes button
                  marginBottom: 8,
                }
              ]}
              onPress={openUrl}
            >
              <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                Go to Site
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.buttonGray,
                { backgroundColor: '#f31919ff', marginTop: 5 }
              ]}
              onPress={confirmDelete}
              disabled={removing}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>
                {removing ? 'Deleting...' : 'Delete Bookmark'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    marginVertical: 10,
    fontSize: 16,
  },
  label: {
    fontSize: 15,
    marginTop: 10,
    marginBottom: 4,
  },
  image: {
    width: '100%',
    height: 200,
    marginVertical: 10,
    resizeMode: 'cover',
    borderRadius: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'flex-start',
    marginVertical: 6,
    rowGap: 8,
  },
  tagBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 32,
    marginRight: 6,
  },
  tagText: {
    fontSize: 15,
  },
  tagRemove: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: 'bold',
  },
  tagInput: {
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 4,
    height: 32,
    minWidth: 80,
    fontSize: 15,
  },
  buttonGray: {
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});