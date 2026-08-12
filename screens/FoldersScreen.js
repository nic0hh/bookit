import React, { useContext, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookmarksContext } from '../context/BookmarksContext';
import { ThemeContext } from '../ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../utils/alert';

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
  const isViewerMode = ctx.isViewerMode || false;

  const [newFolder, setNewFolder] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editName, setEditName] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);

  const sortedFolders = [...(folders || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const currentIdx = editingFolder ? sortedFolders.findIndex(f => f.id === editingFolder.id) : -1;

  useEffect(() => {
    if (editingFolder) setEditName(editingFolder.name || '');
  }, [editingFolder]);

  const createFolder = async () => {
    if (!newFolder.trim()) return;
    if (isViewerMode) { showAlert('Read only', 'Viewing another profile — creating folders is disabled.'); return; }
    await addFolder(newFolder.trim());
    setNewFolder('');
  };

  const openEditModal = (folder) => {
    if (isViewerMode) { showAlert('Read only', 'Viewing another profile — editing is disabled.'); return; }
    setEditingFolder(folder);
    setEditName(folder.name);
    setEditModalVisible(true);
  };

  const confirmDelete = (folder) => {
    if (Platform.OS === 'web') { openEditModal(folder); return; }
    Alert.alert(folder.name, undefined, [
      { text: 'Edit', onPress: () => openEditModal(folder) },
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => await removeFolder(folder.id) },
    ]);
  };

  const handleSave = async () => {
    if (!editingFolder) return;
    const error = await editFolder(editingFolder.id, editName.trim());
    if (error) showAlert('Error', error);
    else setEditModalVisible(false);
  };

  const handleToggleHidden = async () => {
    if (!editingFolder) return;
    try {
      const err = await setFolderHidden(editingFolder.id, !editingFolder.hidden);
      if (err) { showAlert('Error', String(err)); return; }
      setEditModalVisible(false);
      setEditingFolder(null);
    } catch { showAlert('Error', 'Failed to update folder visibility'); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>

      {isViewerMode && (
        <View style={{ padding: 10, backgroundColor: '#fff3cd', borderBottomWidth: 1, borderColor: colors.inputBorder }}>
          <Text style={{ color: '#856404', textAlign: 'center', fontFamily: 'Quicksand_400Regular', fontSize: 13 }}>
            Viewing someone else's folders (read-only)
          </Text>
        </View>
      )}

      {loadingRemote && <ActivityIndicator style={{ marginTop: 40 }} color={colors.label} />}

      <FlatList
        data={sortedFolders}
        keyExtractor={item => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 20,
          maxWidth: 560,
          alignSelf: 'center',
          width: '100%',
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Home', {
              screen: 'FolderBookmarks',
              params: { folderId: item.id, folderName: item.name },
            })}
            onLongPress={() => confirmDelete(item)}
            style={[folderCardStyle(colors), item.hidden && { opacity: 0.5 }]}
          >
            {/* Folder icon + name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[iconBadge(colors)]}>
                <Ionicons
                  name={item.hidden ? 'folder-open-outline' : 'folder-outline'}
                  size={20}
                  color={colors.actionButton === colors.inputBackground ? colors.label : colors.actionButtonText}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Quicksand_600SemiBold' }}>
                  {item.name}
                </Text>
                {item.hidden && (
                  <Text style={{ color: colors.label, fontSize: 11, fontFamily: 'Quicksand_400Regular', marginTop: 2 }}>
                    Hidden from home
                  </Text>
                )}
              </View>
            </View>

            {/* Edit button (always visible on web, hint via long-press on native) */}
            <TouchableOpacity
              style={{ padding: 6 }}
              onPress={() => openEditModal(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.label} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loadingRemote ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="folder-open-outline" size={48} color={colors.inputBorder} />
              <Text style={{ color: colors.label, marginTop: 14, fontFamily: 'Quicksand_400Regular', fontSize: 15 }}>
                No folders yet
              </Text>
              <Text style={{ color: colors.label, fontFamily: 'Quicksand_400Regular', fontSize: 13, marginTop: 4, opacity: 0.7 }}>
                Add one below to get started
              </Text>
            </View>
          ) : null
        }
      />

      {/* Add folder bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
        <View style={{ borderTopWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.background, paddingVertical: 12, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: 560, alignSelf: 'center', width: '100%' }}>
            <TextInput
              value={newFolder}
              onChangeText={setNewFolder}
              onSubmitEditing={createFolder}
              placeholder="New folder name"
              placeholderTextColor={colors.label}
              returnKeyType="done"
              style={{
                flex: 1,
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 11,
                color: colors.text,
                fontSize: 15,
                fontFamily: 'Quicksand_400Regular',
              }}
            />
            <TouchableOpacity
              onPress={createFolder}
              disabled={!newFolder.trim() || isViewerMode}
              style={{
                marginLeft: 10,
                backgroundColor: colors.actionButton,
                borderRadius: 14,
                paddingHorizontal: 20,
                paddingVertical: 11,
                opacity: newFolder.trim() && !isViewerMode ? 1 : 0.4,
              }}
            >
              <Text style={{ color: colors.actionButtonText, fontSize: 15, fontFamily: 'Quicksand_600SemiBold' }}>
                Add
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Edit modal */}
      {editModalVisible && editingFolder && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, width: 300, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 12 }}>

              {/* Modal header */}
              <Text style={{ fontSize: 11, fontFamily: 'Quicksand_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8, color: colors.label, marginBottom: 14 }}>
                Edit Folder
              </Text>

              {/* Name input */}
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: colors.text, marginBottom: 16, fontSize: 15, fontFamily: 'Quicksand_400Regular' }}
                placeholder="Folder name"
                placeholderTextColor={colors.label}
              />

              {/* Save */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={!editName.trim()}
                style={{ backgroundColor: colors.actionButton, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 8, opacity: editName.trim() ? 1 : 0.4 }}
              >
                <Text style={{ color: colors.actionButtonText, fontSize: 15, fontFamily: 'Quicksand_600SemiBold' }}>Save</Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: colors.inputBorder, marginVertical: 12 }} />

              {/* Toggle visibility */}
              <TouchableOpacity
                onPress={handleToggleHidden}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
              >
                <Ionicons
                  name={editingFolder.hidden ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={colors.label}
                  style={{ marginRight: 10 }}
                />
                <Text style={{ color: colors.label, fontSize: 14, fontFamily: 'Quicksand_500Medium' }}>
                  {editingFolder.hidden ? 'Show on home page' : 'Hide from home page'}
                </Text>
              </TouchableOpacity>

              {/* Move up/down */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={async () => { await moveFolder(editingFolder.id, 'up'); setEditModalVisible(false); }}
                  disabled={currentIdx === 0}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: colors.inputBackground, opacity: currentIdx === 0 ? 0.4 : 1 }}
                >
                  <Ionicons name="arrow-up" size={16} color={colors.label} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.label, fontSize: 13, fontFamily: 'Quicksand_500Medium' }}>Move up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => { await moveFolder(editingFolder.id, 'down'); setEditModalVisible(false); }}
                  disabled={currentIdx === sortedFolders.length - 1}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: colors.inputBackground, opacity: currentIdx === sortedFolders.length - 1 ? 0.4 : 1 }}
                >
                  <Ionicons name="arrow-down" size={16} color={colors.label} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.label, fontSize: 13, fontFamily: 'Quicksand_500Medium' }}>Move down</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 1, backgroundColor: colors.inputBorder, marginVertical: 12 }} />

              {/* Delete */}
              <TouchableOpacity
                onPress={async () => { await removeFolder(editingFolder.id); setEditModalVisible(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
              >
                <Ionicons name="trash-outline" size={16} color="#d72660" style={{ marginRight: 10 }} />
                <Text style={{ color: '#d72660', fontSize: 14, fontFamily: 'Quicksand_500Medium' }}>Delete folder</Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={{ alignItems: 'center', paddingTop: 10 }}>
                <Text style={{ color: colors.label, fontSize: 14, fontFamily: 'Quicksand_400Regular' }}>Cancel</Text>
              </TouchableOpacity>

            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// Helper style functions to keep renderItem clean
const folderCardStyle = (colors) => ({
  backgroundColor: colors.card,
  borderRadius: 16,
  paddingVertical: 14,
  paddingHorizontal: 16,
  marginBottom: 10,
  flexDirection: 'row',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 3,
  borderWidth: 0.7,
  borderColor: colors.cardBorder,
});

const iconBadge = (colors) => ({
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: colors.inputBackground,
  justifyContent: 'center',
  alignItems: 'center',
});