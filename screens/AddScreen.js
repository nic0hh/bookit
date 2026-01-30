import React, { useState, useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, TextInput, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BookmarksContext } from '../context/BookmarksContext';
import { useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../ThemeContext';

const API_BASE = 'https://bookitweb.netlify.app/.netlify/functions';

export default function AddScreen({ navigation }) {
  const { addBookmark, folders, bookmarks } = useContext(BookmarksContext);
  const { colors, setThemeName } = useContext(ThemeContext);

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState({ title: '', image: null, url: '' });
  const [imageDimensions, setImageDimensions] = useState({ width: null, height: null });
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [localImage, setLocalImage] = useState(null);
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [previewError, setPreviewError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
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
        
        // Set preview first
        setPreview({
          title: data.title || '',
          image: imageUrl,
          url,
        });
        
        // Get actual image dimensions
        if (imageUrl) {
          Image.getSize(
            imageUrl,
            (width, height) => {
              console.log('Got image dimensions:', width, 'x', height);
              setImageDimensions({ width, height });
            },
            (error) => {
              console.log('Could not get image size:', error);
              setImageDimensions({ width: null, height: null });
            }
          );
        } else {
          setImageDimensions({ width: null, height: null });
        }
        
        // Check for duplicate after loading preview
        checkDuplicate(url);
      }
    } catch (err) {
      setPreviewError('Unable to fetch preview for this URL.');
      setPreview({ title: '', image: null, url });
      console.error('Error fetching preview:', err);
    }
    setLoading(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.cancelled && result.assets && result.assets.length > 0) {
      setLocalImage(result.assets[0].uri);
    }
  };

  const saveBookmark = async () => {
    const finalUrl = (preview.url || url || '').trim();
    if (!finalUrl) return;

    await proceedWithSave(finalUrl);
  };

  const proceedWithSave = async (finalUrl) => {
    // Validation
    if (finalUrl.length > 2048) {
      Alert.alert('Error', 'URL is too long.');
      return;
    }
    if ((preview.title || '').length > 300) {
      Alert.alert('Error', 'Title is too long (max 300 characters).');
      return;
    }
    if (tags.some(tag => tag.length > 32)) {
      Alert.alert('Error', 'Tags must be 32 characters or less.');
      return;
    }
    if (tags.length > 10) {
      Alert.alert('Error', 'You can add up to 10 tags per bookmark.');
      return;
    }

    await addBookmark({
      title: (preview.title || '').trim(),
      url: finalUrl,
      image: localImage || preview.image || null,
      imageWidth: imageDimensions.width,
      imageHeight: imageDimensions.height,
      tags: normalizeTags(tags),
      folderIds: selectedFolders,
    });
    console.log('Saving with dimensions:', imageDimensions);
    navigation.goBack();
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
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const checkDuplicate = (checkUrl) => {
    const existingBookmark = bookmarks.find(b => b.url === checkUrl);
    if (existingBookmark) {
      // Handle both new folder_ids array and legacy folder_id
      const folderIds = existingBookmark.folder_ids || (existingBookmark.folder_id ? [existingBookmark.folder_id] : []);
      
      if (folderIds.length === 0) {
        setDuplicateWarning(`Already saved in "Home" (but you can still add to folders)`);
      } else if (folderIds.length === 1) {
        const folderName = folders.find(f => f.id === folderIds[0])?.name || 'a folder';
        setDuplicateWarning(`Already saved in "${folderName}" (but you can still add to other folders)`);
      } else {
        setDuplicateWarning(`Already saved in ${folderIds.length} folders (but you can still add to others)`);
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  const CustomPicker = ({ value, options, onChange, colors }) => {
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
          <Text style={{ color: colors.text }}>{selectedLabel}</Text>
        </TouchableOpacity>
        <Modal visible={visible} transparent animationType="fade">
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'center',
              alignItems: 'center',
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
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.inputBorder,
                    }}
                    onPress={() => {
                      onChange(item.value);
                      setVisible(false);
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 17 }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );  
  };

  const MultiFolderPicker = ({ selectedIds, folders, onChange, colors }) => {
    const [visible, setVisible] = useState(false);

    const toggleFolder = (folderId) => {
      if (selectedIds.includes(folderId)) {
        onChange(selectedIds.filter(id => id !== folderId));
      } else {
        onChange([...selectedIds, folderId]);
      }
    };

    const selectedLabel = selectedIds.length === 0
      ? 'None selected'
      : selectedIds.length === 1
      ? folders.find(f => f.id === selectedIds[0])?.name || '1 folder'
      : `${selectedIds.length} folders`;

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
          <Text style={{ color: colors.text }}>{selectedLabel}</Text>
        </TouchableOpacity>
        <Modal visible={visible} transparent animationType="fade">
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setVisible(false)}
            activeOpacity={1}
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                minWidth: 250,
                maxHeight: 400,
              }}
              onStartShouldSetResponder={() => true}
            >
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
                Select Folders
              </Text>
              <FlatList
                data={folders}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.inputBorder,
                      }}
                      onPress={() => toggleFolder(item.id)}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: colors.actionButton,
                          backgroundColor: isSelected ? colors.actionButton : 'transparent',
                          marginRight: 12,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        {isSelected && (
                          <Text style={{ color: colors.card, fontSize: 16, fontWeight: 'bold' }}>✓</Text>
                        )}
                      </View>
                      <Text style={{ color: colors.text, fontSize: 17, flex: 1 }}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
              <TouchableOpacity
                style={{
                  marginTop: 12,
                  padding: 12,
                  backgroundColor: colors.actionButton,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
                onPress={() => setVisible(false)}
              >
                <Text style={{ color: colors.actionButtonText, fontSize: 16, fontWeight: 'bold' }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  function normalizeTags(tags) {
    return Array.from(
      new Set(
        (Array.isArray(tags) ? tags : tags.split(','))
          .map(t => t.trim().toLowerCase())
          .filter(t => t && t.length <= 32)
      )
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {preview.url ? (
          Platform.OS === 'web' ? (
            <View
              style={[
                styles.preview,
                { backgroundColor: colors.card },
                { width: 400, alignSelf: 'center', height: 650, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
              ]}
            >
              <ScrollView
                style={{ flex: 1, minHeight: 0 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator
              >
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                  value={preview.title}
                  onChangeText={(text) => setPreview({ ...preview, title: text })}
                />

                {duplicateWarning && (
                  <Text style={{ color: '#ef4444', fontSize: 13, marginTop: -6, marginBottom: 8 }}>
                    {duplicateWarning}
                  </Text>
                )}

                {(preview.image || localImage) ? (
                  <Image
                    source={{ uri: localImage || preview.image }}
                    style={styles.image}
                  />
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.buttonGray,
                    {
                      backgroundColor: colors.actionButton,
                      borderWidth: 0.7,
                      borderColor: colors.actionButtonText, // 👈 add border with actionButtonText color
                    }
                  ]}
                  onPress={pickImage}
                >
                  <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                    Swap / Upload Image
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.label, { color: colors.text }]}>Tags (type and press space):</Text>
                <ScrollView
                  horizontal
                  contentContainerStyle={{ alignItems: 'center' }}
                  showsHorizontalScrollIndicator={false}
                >
                  <View style={styles.tagsRow}>
                    {tags.map((tag, idx) => (
                      <View
                        key={idx}
                        style={[styles.tagBubble, { backgroundColor: colors.tag }]}
                      >
                        <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
                        <Text
                          style={[styles.tagRemove, { color: colors.label }]}
                          onPress={() => removeTag(tag)}
                        >
                          ×
                        </Text>
                      </View>
                    ))}
                    <TextInput
                      style={[
                        styles.tagInput,
                        {
                          backgroundColor: colors.inputBackground,
                          color: colors.text,
                          borderColor: colors.inputBorder,
                        },
                      ]}
                      value={tagInput}
                      onChangeText={handleTagInput}
                      placeholder="Add tag"
                      placeholderTextColor={colors.label}
                      autoCapitalize="none"
                    />
                  </View>
                </ScrollView>

                <Text style={[styles.label, { color: colors.text }]}>Select Folders:</Text>
                <MultiFolderPicker
                  selectedIds={selectedFolders}
                  folders={folders}
                  onChange={(ids) => {
                    setSelectedFolders(ids);
                    if (preview.url || url) {
                      checkDuplicate(preview.url || url);
                    }
                  }}
                  colors={colors}
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
                  onPress={saveBookmark}
                  disabled={!preview.url && !url}
                >
                  <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                    Save Bookmark
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={[styles.preview, { backgroundColor: colors.card, flex: 1 }]}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            >
              <ScrollView
                style={{ flex: 1, minHeight: 0 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator
              >
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBackground,
                      color: colors.text,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                  value={preview.title}
                  onChangeText={(text) => setPreview({ ...preview, title: text })}
                />

                {duplicateWarning && (
                  <Text style={{ color: '#ef4444', fontSize: 13, marginTop: -6, marginBottom: 8 }}>
                    {duplicateWarning}
                  </Text>
                )}

                {(preview.image || localImage) ? (
                  <Image
                    source={{ uri: localImage || preview.image }}
                    style={styles.image}
                  />
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.buttonGray,
                    {
                      backgroundColor: colors.actionButton,
                      borderWidth: 0.7,
                      borderColor: colors.actionButtonText, // 👈 add border with actionButtonText color
                    }
                  ]}
                  onPress={pickImage}
                >
                  <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                    Swap / Upload Image
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.label, { color: colors.text }]}>Tags (type and press space):</Text>
                <ScrollView
                  horizontal
                  contentContainerStyle={{ alignItems: 'center' }}
                  showsHorizontalScrollIndicator={false}
                >
                  <View style={styles.tagsRow}>
                    {tags.map((tag, idx) => (
                      <View
                        key={idx}
                        style={[styles.tagBubble, { backgroundColor: colors.tag }]}
                      >
                        <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
                        <Text
                          style={[styles.tagRemove, { color: colors.label }]}
                          onPress={() => removeTag(tag)}
                        >
                          ×
                        </Text>
                      </View>
                    ))}
                    <TextInput
                      style={[
                        styles.tagInput,
                        {
                          backgroundColor: colors.inputBackground,
                          color: colors.text,
                          borderColor: colors.inputBorder,
                        },
                      ]}
                      value={tagInput}
                      onChangeText={handleTagInput}
                      placeholder="Add tag"
                      placeholderTextColor={colors.label}
                      autoCapitalize="none"
                    />
                  </View>
                </ScrollView>

                <Text style={[styles.label, { color: colors.text }]}>Select Folders:</Text>
                <MultiFolderPicker
                  selectedIds={selectedFolders}
                  folders={folders}
                  onChange={(ids) => {
                    setSelectedFolders(ids);
                    if (preview.url || url) {
                      checkDuplicate(preview.url || url);
                    }
                  }}
                  colors={colors}
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
                  onPress={saveBookmark}
                  disabled={!preview.url && !url}
                >
                  <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                    Save Bookmark
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          )
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.container,
              { backgroundColor: colors.background, ...(Platform.OS === 'web' ? { maxWidth: 450, alignSelf: 'center' } : {}) },
            ]}
            scrollEnabled={Platform.OS !== 'web'}
          >
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                  borderColor: colors.inputBorder,
                  ...(Platform.OS === 'web' ? { width: 400, alignSelf: 'center' } : {}),
                },
              ]}
              value={url}
              onChangeText={setUrl}
              onBlur={() => {
                if (url) {
                  checkDuplicate(url);
                }
              }}
              placeholder="https://example.com"
              placeholderTextColor={colors.label}
              autoCapitalize="none"
            />
            {duplicateWarning && (
              <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 4, textAlign: Platform.OS === 'web' ? 'center' : 'left' }}>
                {duplicateWarning}
              </Text>
            )}
            <TouchableOpacity
              style={[
                styles.buttonGray,
                {
                  backgroundColor: colors.actionButton, // 👈 switched: use actionButtonText as background
                  borderWidth: 0.7,
                  borderColor: colors.actionButtonText,         // optional: add border for contrast
                }
              ]}
              onPress={fetchPreview}
            >
              <Text style={[styles.buttonText, { color: colors.actionButtonText }]}>
                Fetch Preview
              </Text>
            </TouchableOpacity>
            {loading && (
              <Text style={[styles.loadingText, { color: colors.text }]}>Loading preview...</Text>
            )}
            {previewError ? (
              <Text style={{ color: colors.text, fontFamily: 'Quicksand', marginTop: 10 }}>
                {previewError}
              </Text>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    marginVertical: 10,
    fontSize: 16,
  },
  label: {
    fontSize: 15,
    marginBottom: 2,
  },
  loadingText: {
    fontSize: 15,
    marginVertical: 8,
  },
  preview: {
    marginTop: 20,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
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
    alignItems: 'center',
    marginVertical: 0,
  },
  tagBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 32,
    marginRight: 6,
    marginBottom: 6,
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
    paddingHorizontal: 24,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
