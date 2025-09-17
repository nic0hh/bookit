import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookmarksContext } from '../context/BookmarksContext';
import { ThemeContext } from '../ThemeContext';

export default function FoldersScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const {
    folders,
    addFolder,
    removeFolder,
    loadingRemote,
    editFolder,
  } = useContext(BookmarksContext);

  const { setThemeName } = useContext(ThemeContext);

  const [newFolder, setNewFolder] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editName, setEditName] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);

  const createFolder = async () => {
    if (!newFolder.trim()) return;
    await addFolder(newFolder.trim());
    setNewFolder('');
  };

  const confirmDelete = (folder) => {
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
      ]
    );
  };

  const handleSave = async () => {
    const error = await editFolder(editingFolder.id, editName.trim());
    if (error) {
      Alert.alert('Error', error);
    } else {
      setEditModalVisible(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top']}
    >
      {loadingRemote && (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.label} />
      )}

      <FlatList
        data={folders}
        keyExtractor={item => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 40, // 👈 add this line to move folders down
        }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.85}
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
              borderWidth: 0.7, // 👈 add border
              borderColor: colors.actionButtonText, // 👈 use actionButtonText color for border
              ...(Platform.OS === 'web'
                ? {
                    maxWidth: 340,
                    alignSelf: 'center',
                    width: '100%',
                  }
                : {
                    maxWidth: 280,         // 👈 shorter on app
                    alignSelf: 'center',   // 👈 center on app
                    width: '100%',
                  }),
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 17,
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loadingRemote ? (
            <Text style={{ color: colors.label, textAlign: 'center', marginTop: 40 }}>
              No folders yet
            </Text>
          ) : null
        }
      />

      {/* Input bar stays flush at the bottom */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.background,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              // 👇 Web-only: center and shrink
              ...(Platform.OS === 'web'
                ? {
                    maxWidth: 340,
                    alignSelf: 'center',
                    width: '100%',
                  }
                : {}),
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
                ...(Platform.OS === 'web'
                  ? {
                      minWidth: 0,
                      maxWidth: 180,
                    }
                  : {}),
              }}
            />
            <TouchableOpacity
              onPress={createFolder}
              disabled={!newFolder.trim()}
              style={{
                marginLeft: 10,
                backgroundColor: colors.actionButton, // use actionButton color
                borderRadius: 12,
                paddingHorizontal: 18,
                paddingVertical: 12,
                opacity: newFolder.trim() ? 1 : 0.5,
                borderWidth: 0.7, // add border
                borderColor: colors.actionButtonText, // use actionButtonText color for border
                ...(Platform.OS === 'web'
                  ? {
                      minWidth: 0,
                      maxWidth: 80,
                      paddingHorizontal: 12,
                    }
                  : {}),
              }}
            >
              <Text
                style={{
                  color: colors.actionButtonText, // use actionButtonText color for text
                  fontSize: 15,
                  fontWeight: 'bold',
                }}
              >
                Add
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {editModalVisible && (
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 24,
              width: 280,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text style={{ fontSize: 16, marginBottom: 12, color: colors.text, fontWeight: 'bold' }}>
              Edit folder name
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={{
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                marginBottom: 16,
                fontSize: 15,
              }}
              placeholder="Folder name"
              placeholderTextColor={colors.label}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={{ marginRight: 12 }}
              >
                <Text style={{ color: colors.label, fontSize: 15 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={{ backgroundColor: colors.button, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
                disabled={!editName.trim()}
              >
                <Text style={{ color: colors.buttonText, fontSize: 15, fontWeight: 'bold' }}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
