import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
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
  } = useContext(BookmarksContext);

  const [newFolder, setNewFolder] = useState('');

  const createFolder = async () => {
    if (!newFolder.trim()) return;
    await addFolder(newFolder.trim());
    setNewFolder('');
  };

  const confirmDelete = (folder) => {
    Alert.alert(
      'Delete Folder',
      `Delete "${folder.name}"?`,
      [
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {loadingRemote && (
        <ActivityIndicator style={{ marginTop: 10 }} color={colors.label} />
      )}

      <FlatList
        data={folders}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
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
              padding: 18,
              marginBottom: 12,
              ...(index === 0 ? { marginTop: 8 } : {}),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
              // 👇 Web-only styles
              ...(Platform.OS === 'web'
                ? {
                    maxWidth: 340,
                    alignSelf: 'center',
                    width: '100%',
                  }
                : {}),
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontFamily: 'Quicksand',
                fontSize: 17,                // 👈 updated font size
                fontWeight: 'bold',          // 👈 make it bold
                ...(Platform.OS === 'web' ? { textAlign: 'center' } : {}),
              }}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loadingRemote ? (
            <Text style={{ color: colors.label, textAlign: 'center', marginTop: 40, fontFamily: 'Quicksand' }}>
              No folders yet
            </Text>
          ) : null
        }
      />

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
              fontFamily: 'Quicksand',
              color: colors.text,
              ...(Platform.OS === 'web'
                ? {
                    fontSize: 15,
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
              backgroundColor: colors.button,
              borderRadius: 12,
              paddingHorizontal: 18,
              paddingVertical: 12,
              opacity: newFolder.trim() ? 1 : 0.5,
              ...(Platform.OS === 'web'
                ? {
                    minWidth: 0,
                    maxWidth: 80,
                    paddingHorizontal: 12,
                  }
                : {}),
            }}
          >
            <Text style={{ fontFamily: 'Quicksand', color: colors.buttonText, ...(Platform.OS === 'web' ? { fontSize: 15 } : {}) }}>
              Add
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
