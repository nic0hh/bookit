import React, { useContext, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { ProfilesContext } from '../context/ProfilesContext';
import { BookmarksContext } from '../context/BookmarksContext';
import { ThemeContext } from '../ThemeContext';
import { supabase } from '../supabaseClient';

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useContext(AuthContext);
  const {
    profile,
    sharedPermissions = [],
    pendingRequests = [],
    loadSharedPermissions,
    loadPendingRequests,
    acceptShareRequest,
    denyShareRequest,
    updateSharedFolders,
  } = useContext(ProfilesContext);
  const { colors } = useContext(ThemeContext);
  const { folders } = useContext(BookmarksContext);

  const [shareEmail, setShareEmail] = useState('');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [settingsMenuVisible, setSettingsMenuVisible] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [blockedModalVisible, setBlockedModalVisible] = useState(false);
  const [blockedEmails, setBlockedEmails] = useState([]);
  const [blockEmail, setBlockEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadSharedPermissions();
      loadPendingRequests();
    }
  }, [user]);

  const handleShare = async () => {
    if (!shareEmail.trim()) {
      Alert.alert('Error', 'Please enter an email');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('share_profile_with_email', {
        viewer_email: shareEmail.trim(),
      });

      if (error) {
        console.error('share_profile_with_email error:', error);
        Alert.alert('Error', error.message || 'Failed to share profile');
        return;
      }

      if (data?.error) {
        Alert.alert('Error', data.error);
        return;
      }

      Alert.alert('Success', `Share request sent to ${shareEmail}`);
      setShareEmail('');
      setShareModalVisible(false);

      await loadSharedPermissions();
    } catch (err) {
      console.error('handleShare exception:', err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async (viewerEmail) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('unshare_profile_with_email', {
        viewer_email: viewerEmail,
      });

      if (error) {
        console.error('unshare error:', error);
        Alert.alert('Error', error.message || 'Failed to unshare');
        return;
      }

      if (data?.error) {
        Alert.alert('Error', data.error);
        return;
      }

      Alert.alert('Success', `Unshared with ${viewerEmail}`);
      await loadSharedPermissions();
    } catch (err) {
      console.error('handleUnshare exception:', err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId, username) => {
    setLoading(true);
    try {
      const { error } = await acceptShareRequest(requestId);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to accept request');
        return;
      }

      Alert.alert('Success', `You can now view ${username}'s bookmarks`);
    } catch (err) {
      console.error('handleAcceptRequest exception:', err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDenyRequest = async (requestId, username) => {
    setLoading(true);
    try {
      const { error } = await denyShareRequest(requestId);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to deny request');
        return;
      }

      Alert.alert('Success', `Denied share request from ${username}`);
    } catch (err) {
      console.error('handleDenyRequest exception:', err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (perm) => {
    setEditingPermission(perm);
    setSelectedFolderIds(perm.folder_ids || []);
    setEditModalVisible(true);
  };

  const handleUpdateFolders = async () => {
    if (!editingPermission) return;

    setLoading(true);
    try {
      const { error } = await updateSharedFolders(editingPermission.id, selectedFolderIds);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to update folders');
        return;
      }

      Alert.alert('Success', 'Folder permissions updated');
      setEditModalVisible(false);
      setEditingPermission(null);
      await loadSharedPermissions();
    } catch (err) {
      console.error('handleUpdateFolders exception:', err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderId) => {
    setSelectedFolderIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: '#ff9500', text: 'Pending' },
      accepted: { bg: '#34c759', text: 'Accepted' },
      denied: { bg: '#ff3b30', text: 'Denied' },
    };
    const style = styles[status] || styles.pending;
    return (
      <View style={{ backgroundColor: style.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{style.text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>
        <Text style={{ color: colors.label, marginBottom: 20 }}>
          {user?.email || 'Not signed in'}
        </Text>

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
              Pending Requests ({pendingRequests.length})
            </Text>
            {pendingRequests.map((req) => (
              <View
                key={req.id}
                style={{
                  backgroundColor: colors.card,
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  maxWidth: '85%',
                  alignSelf: 'center',
                  width: '100%',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
                  {req.username} wants to share
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleAcceptRequest(req.id, req.username)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      backgroundColor: colors.actionButton,
                      paddingVertical: 10,
                      borderRadius: 8,
                      alignItems: 'center',
                      borderWidth: 0.7,
                      borderColor: colors.actionButtonText,
                    }}
                  >
                    <Text style={{ color: colors.actionButtonText, fontWeight: 'bold' }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDenyRequest(req.id, req.username)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      backgroundColor: colors.inputBackground,
                      paddingVertical: 10,
                      borderRadius: 8,
                      alignItems: 'center',
                      borderWidth: 0.7,
                      borderColor: colors.inputBorder,
                    }}
                  >
                    <Text style={{ color: colors.label, fontWeight: 'bold' }}>Deny</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Shared With Section */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
          Shared With ({sharedPermissions.length})
        </Text>

        {sharedPermissions.length === 0 ? (
          <Text style={{ color: colors.label, fontStyle: 'italic', marginBottom: 20 }}>
            Not sharing with anyone yet
          </Text>
        ) : (
          sharedPermissions.map((perm) => (
            <TouchableOpacity
              key={perm.id}
              onPress={() => openEditModal(perm)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: colors.card,
                padding: 12,
                borderRadius: 12,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>
                  {perm.email || perm.viewer_id}
                </Text>
                {getStatusBadge(perm.status)}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedPermission(perm);
                  setSettingsMenuVisible(true);
                }}
                disabled={loading}
                style={{
                  padding: 8,
                }}
              >
                <Ionicons name="settings-outline" size={24} color={colors.text} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          onPress={() => setShareModalVisible(true)}
          style={{
            backgroundColor: colors.actionButton,
            padding: 14,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 12,
            borderWidth: 1,
            borderColor: colors.actionButtonText,
          }}
        >
          <Text style={{ color: colors.actionButtonText, fontWeight: 'bold', fontSize: 16 }}>
            + Share with new user
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setBlockedModalVisible(true)}
          style={{
            backgroundColor: colors.actionButton,
            padding: 14,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 40,
            borderWidth: 0.7,
            borderColor: colors.actionButtonText,
          }}
        >
          <Text style={{ color: colors.actionButtonText, fontWeight: 'bold', fontSize: 16 }}>
            Blocked Profiles ({blockedEmails.length})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Share Modal */}
      {shareModalVisible && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              padding: 24,
              borderRadius: 16,
              width: 320,
              maxWidth: '90%',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>
              Share your profile
            </Text>

            <TextInput
              value={shareEmail}
              onChangeText={setShareEmail}
              placeholder="Enter user's email"
              placeholderTextColor={colors.label}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 12,
                padding: 12,
                color: colors.text,
                marginBottom: 16,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShareModalVisible(false);
                  setShareEmail('');
                }}
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: colors.inputBackground,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                }}
              >
                <Text style={{ color: colors.label, fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                disabled={loading || !shareEmail.trim()}
                style={{
                  flex: 1,
                  backgroundColor: colors.actionButton,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.actionButtonText,
                  opacity: loading || !shareEmail.trim() ? 0.5 : 1,
                }}
              >
                <Text style={{ color: colors.actionButtonText, fontWeight: 'bold' }}>
                  {loading ? 'Sending...' : 'Send Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Settings Menu Modal */}
      {settingsMenuVisible && selectedPermission && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              padding: 20,
              borderRadius: 16,
              width: 280,
              maxWidth: '90%',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 16, textAlign: 'center' }}>
              {selectedPermission.email || 'User'}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setSettingsMenuVisible(false);
                openEditModal(selectedPermission);
              }}
              style={{
                backgroundColor: colors.actionButton,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 10,
                borderWidth: 0.7,
                borderColor: colors.actionButtonText,
              }}
            >
              <Text style={{ color: colors.actionButtonText, fontWeight: 'bold' }}>Manage Folders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setSettingsMenuVisible(false);
                handleUnshare(selectedPermission.email);
              }}
              style={{
                backgroundColor: colors.inputBackground,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 10,
                borderWidth: 0.7,
                borderColor: colors.inputBorder,
              }}
            >
              <Text style={{ color: colors.label, fontWeight: 'bold' }}>Unshare</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setSettingsMenuVisible(false);
                const emailToBlock = selectedPermission.email;
                if (emailToBlock && !blockedEmails.includes(emailToBlock)) {
                  setBlockedEmails([...blockedEmails, emailToBlock]);
                  handleUnshare(emailToBlock);
                  Alert.alert('Blocked', `${emailToBlock} has been blocked and unshared`);
                }
              }}
              style={{
                backgroundColor: '#ff3b30',
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Block User</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSettingsMenuVisible(false)}
              style={{
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.label }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Edit Permissions Modal */}
      {editModalVisible && editingPermission && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              padding: 24,
              borderRadius: 16,
              width: 320,
              maxWidth: '90%',
              maxHeight: '80%',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>
              Manage Folder Sharing
            </Text>
            <Text style={{ color: colors.label, fontSize: 14, marginBottom: 16 }}>
              {editingPermission.email || 'User'} • Home screen always shared
            </Text>

            <ScrollView style={{ marginBottom: 16, maxHeight: 300 }}>
              {folders.length === 0 ? (
                <Text style={{ color: colors.label, fontStyle: 'italic' }}>No folders created yet</Text>
              ) : (
                folders.map((folder) => (
                  <TouchableOpacity
                    key={folder.id}
                    onPress={() => toggleFolder(folder.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: colors.inputBackground,
                      borderRadius: 8,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: selectedFolderIds.includes(folder.id)
                        ? '#007aff'
                        : colors.inputBorder,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: selectedFolderIds.includes(folder.id) ? '#007aff' : colors.label,
                        backgroundColor: selectedFolderIds.includes(folder.id)
                          ? '#007aff'
                          : 'transparent',
                        marginRight: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {selectedFolderIds.includes(folder.id) && (
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>✓</Text>
                      )}
                    </View>
                    <Text style={{ color: colors.text, flex: 1 }}>{folder.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingPermission(null);
                }}
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: colors.inputBackground,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleUpdateFolders}
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: '#007aff',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  {loading ? 'Updating...' : 'Update'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Blocked Profiles Modal */}
      {blockedModalVisible && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              padding: 24,
              borderRadius: 16,
              width: 320,
              maxWidth: '90%',
              maxHeight: '80%',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 16 }}>
              Blocked Profiles
            </Text>

            <TextInput
              value={blockEmail}
              onChangeText={setBlockEmail}
              placeholder="Enter email to block"
              placeholderTextColor={colors.label}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 12,
                padding: 12,
                color: colors.text,
                marginBottom: 12,
              }}
            />

            <TouchableOpacity
              onPress={() => {
                if (blockEmail.trim() && !blockedEmails.includes(blockEmail.trim())) {
                  setBlockedEmails([...blockedEmails, blockEmail.trim()]);
                  setBlockEmail('');
                  Alert.alert('Blocked', `${blockEmail.trim()} has been blocked`);
                }
              }}
              disabled={!blockEmail.trim()}
              style={{
                backgroundColor: colors.actionButton,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 16,
                borderWidth: 0.7,
                borderColor: colors.actionButtonText,
                opacity: blockEmail.trim() ? 1 : 0.5,
              }}
            >
              <Text style={{ color: colors.actionButtonText, fontWeight: 'bold' }}>Block Email</Text>
            </TouchableOpacity>

            <ScrollView style={{ marginBottom: 16, maxHeight: 300 }}>
              {blockedEmails.length === 0 ? (
                <Text style={{ color: colors.label, fontStyle: 'italic', textAlign: 'center' }}>
                  No blocked emails
                </Text>
              ) : (
                blockedEmails.map((email, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: colors.inputBackground,
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                    }}
                  >
                    <Text style={{ color: colors.text, flex: 1 }}>{email}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setBlockedEmails(blockedEmails.filter((e) => e !== email));
                        Alert.alert('Unblocked', `${email} has been unblocked`);
                      }}
                      style={{
                        padding: 4,
                      }}
                    >
                      <Text style={{ color: '#ff3b30', fontSize: 18, fontWeight: 'bold' }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setBlockedModalVisible(false)}
              style={{
                backgroundColor: colors.inputBackground,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.inputBorder,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});