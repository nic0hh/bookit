import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookmarksContext } from '../context/BookmarksContext';
import { ThemeContext } from '../ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function FoldersScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const ctx = useContext(BookmarksContext) || {};
  const folders = ctx.folders || [];
  const addFolder = ctx.addFolder;
  const removeFolder = ctx.removeFolder;
  const loadingRemote = ctx.loadingRemote || false;
  const editFolder = ctx.editFolder;
  const moveFolder = ctx.moveFolder;
  const setFolderHidden = ctx.setFolderHidden;

  const [newFolder, setNewFolder] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editName, setEditName] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Sort folders by position for display and modal logic
  const sortedFolders = [...(folders || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const currentIdx = editingFolder ? sortedFolders.findIndex(f => f.id === editingFolder.id) : -1;

  useEffect(() => {
    if (editingFolder) {
      setEditName(editingFolder.name || '');
    }
  }, [editingFolder]);

  const createFolder = async () => {
    if (!newFolder.trim()) return;
    await addFolder(newFolder.trim());
    setNewFolder('');
  };

  const confirmDelete = (folder) => {
    if (Platform.OS === 'web') {
      setEditingFolder(folder);
      setEditName(folder.name);
      setEditModalVisible(true);
      return;
    }

    Alert.alert(
      folder.name,
      undefined,
      [
        {
          text: 'Edit',
          onPress: () => {
            setEditingFolder(folder);
            setEditName(folder.name);
            setEditModalVisible(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeFolder(folder.id);
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (!editingFolder) return;
    const error = await editFolder(editingFolder.id, editName.trim());
    if (error) {
      Alert.alert('Error', error);
    } else {
      setEditModalVisible(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {loadingRemote && <ActivityIndicator style={{ marginTop: 40 }} color={colors.label} />}

      <FlatList
        data={sortedFolders}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 40 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate('Home', {
                screen: 'FolderBookmarks',
                params: { folderId: item.id, folderName: item.name },
              })
            }
            onLongPress={() => confirmDelete(item)}
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 16,
              marginBottom: 12,
              ...(index === 0 ? { marginTop: 8 } : {}),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
              borderWidth: 0.7,
              borderColor: colors.actionButtonText,
              ...(Platform.OS === 'web'
                ? { maxWidth: 340, alignSelf: 'center', width: '100%', position: 'relative' }
                : { maxWidth: 280, alignSelf: 'center', width: '100%' }),
            }}
          >
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: 'bold', textAlign: 'center' }}>
              {item.name}
            </Text>

            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={{ position: 'absolute', top: 10, right: 10, padding: 6, zIndex: 2 }}
                onPress={() => confirmDelete(item)}
              >
                <Ionicons name="ellipsis-vertical" size={22} color={colors.icon || colors.text} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loadingRemote ? (
            <Text style={{ color: colors.label, textAlign: 'center', marginTop: 40 }}>No folders yet</Text>
          ) : null
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
        <View style={{ borderTopWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.background, paddingVertical: 10, paddingHorizontal: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              ...(Platform.OS === 'web' ? { maxWidth: 340, alignSelf: 'center', width: '100%' } : {}),
            }}
          >
            <TextInput
              value={newFolder}
              onChangeText={setNewFolder}
              placeholder="New folder name"
              placeholderTextColor={colors.label}
              style={{
                flex: 1,
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: colors.text,
                fontSize: 15,
                ...(Platform.OS === 'web' ? { minWidth: 0, maxWidth: 180 } : {}),
              }}
            />
            <TouchableOpacity
              onPress={createFolder}
              disabled={!newFolder.trim()}
              style={{
                marginLeft: 10,
                backgroundColor: colors.actionButton,
                borderRadius: 12,
                paddingHorizontal: 18,
                paddingVertical: 12,
                opacity: newFolder.trim() ? 1 : 0.5,
                borderWidth: 0.7,
                borderColor: colors.actionButtonText,
                ...(Platform.OS === 'web' ? { minWidth: 0, maxWidth: 80, paddingHorizontal: 12 } : {}),
              }}
            >
              <Text style={{ color: colors.actionButtonText, fontSize: 15, fontWeight: 'bold' }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {editModalVisible && editingFolder && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: 320, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 }}>
            <Text style={{ fontSize: 16, marginBottom: 12, color: colors.text, fontWeight: 'bold' }}>Edit folder name</Text>

            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, marginBottom: 16, fontSize: 15 }}
              placeholder="Folder name"
              placeholderTextColor={colors.label}
            />

            <View style={{ alignItems: 'stretch', marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={{ borderRadius: 15, paddingVertical: 12, alignItems: 'center', marginBottom: 10, borderWidth: 0.7, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }}
              >
                <Text style={{ color: colors.label, fontSize: 16, fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                style={{ borderRadius: 15, paddingVertical: 12, alignItems: 'center', marginBottom: 10, borderWidth: 0.7, backgroundColor: colors.actionButton, borderColor: colors.actionButtonText, opacity: editName.trim() ? 1 : 0.5 }}
                disabled={!editName.trim()}
              >
                <Text style={{ color: colors.actionButtonText, fontSize: 16, fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={async () => {
                const newHidden = !editingFolder?.hidden;
                await setFolderHidden(editingFolder.id, newHidden);
                setEditingFolder(prev => ({ ...prev, hidden: newHidden }));
                setEditModalVisible(false);
              }}
              style={{ borderRadius: 15, paddingVertical: 12, alignItems: 'center', marginBottom: 10, borderWidth: 0.7, backgroundColor: editingFolder?.hidden ? '#28a745' : '#ff9f00', borderColor: colors.actionButtonText }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                {editingFolder?.hidden ? 'Add to Home Page' : 'Remove from Home Page'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                if (!editingFolder) return;
                await moveFolder(editingFolder.id, 'up');
                setEditModalVisible(false);
              }}
              style={{ borderRadius: 15, paddingVertical: 12, alignItems: 'center', marginBottom: 10, borderWidth: 0.7, backgroundColor: colors.actionButton, borderColor: colors.actionButtonText, opacity: currentIdx === 0 ? 0.5 : 1 }}
              disabled={currentIdx === 0}
            >
              <Text style={{ color: colors.actionButtonText, fontSize: 16, fontWeight: 'bold' }}>Move Up</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                if (!editingFolder) return;
                await moveFolder(editingFolder.id, 'down');
                setEditModalVisible(false);
              }}
              style={{ borderRadius: 15, paddingVertical: 12, alignItems: 'center', marginBottom: 10, borderWidth: 0.7, backgroundColor: colors.actionButton, borderColor: colors.actionButtonText, opacity: currentIdx === sortedFolders.length - 1 ? 0.5 : 1 }}
              disabled={currentIdx === sortedFolders.length - 1}
            >
              <Text style={{ color: colors.actionButtonText, fontSize: 16, fontWeight: 'bold' }}>Move Down</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                if (!editingFolder) return;
                await removeFolder(editingFolder.id);
                setEditModalVisible(false);
              }}
              style={{ borderRadius: 15, paddingVertical: 12, alignItems: 'center', marginBottom: 0, borderWidth: 0.7, backgroundColor: '#ff1f1fff', borderColor: '#fd0c0cff' }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}