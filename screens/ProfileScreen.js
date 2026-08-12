import React, { useContext, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { ProfilesContext } from '../context/ProfilesContext';
import { BookmarksContext } from '../context/BookmarksContext';
import { ThemeContext } from '../ThemeContext';
import { supabase } from '../supabaseClient';
import { showAlert } from '../utils/alert';

// ── Reusable modal shell ─────────────────────────────────────────────────────
function Sheet({ visible, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={sheet.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          {children}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pending:  { bg: '#ff9500', label: 'Pending'  },
    accepted: { bg: '#34c759', label: 'Accepted' },
    denied:   { bg: '#ff3b30', label: 'Denied'   },
  };
  const s = map[status] || map.pending;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginTop: 4 }}>
      <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Quicksand_600SemiBold' }}>{s.label}</Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useContext(AuthContext);
  const {
    profile, sharedProfiles = [], sharedPermissions = [], pendingRequests = [],
    loadSharedPermissions, loadPendingRequests, acceptShareRequest, denyShareRequest,
    updateSharedFolders, activeProfileId, switchActiveProfile,
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
  const [sharedProfileMenuVisible, setSharedProfileMenuVisible] = useState(false);
  const [selectedSharedProfile, setSelectedSharedProfile] = useState(null);
  const [blockedModalVisible, setBlockedModalVisible] = useState(false);
  const [blockedEmails, setBlockedEmails] = useState([]);
  const [blockEmail, setBlockEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [myFolders, setMyFolders] = useState([]);

  useEffect(() => {
    if (user) {
      loadSharedPermissions();
      loadPendingRequests();
      loadMyFolders();
    }
  }, [user]);

  const loadMyFolders = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('folders').select('*').eq('user_id', user.id).order('position', { ascending: true });
      setMyFolders(error ? [] : (data || []));
    } catch { setMyFolders([]); }
  };

  const handleShare = async () => {
    if (!shareEmail.trim()) { showAlert('Error', 'Please enter an email'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('share_profile_with_email', { viewer_email: shareEmail.trim() });
      if (error || data?.error) { showAlert('Error', error?.message || data?.error || 'Failed to share'); return; }
      showAlert('Sent', `Share request sent to ${shareEmail}`);
      setShareEmail(''); setShareModalVisible(false);
      await loadSharedPermissions();
    } catch { showAlert('Error', 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const handleUnshare = async (viewerEmail) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('unshare_profile_with_email', { viewer_email: viewerEmail });
      if (error || data?.error) { showAlert('Error', error?.message || data?.error || 'Failed to unshare'); return; }
      showAlert('Done', `Unshared with ${viewerEmail}`);
      await loadSharedPermissions();
    } catch { showAlert('Error', 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const handleAcceptRequest = async (requestId, username) => {
    setLoading(true);
    try {
      const { error } = await acceptShareRequest(requestId);
      if (error) { showAlert('Error', error.message || 'Failed to accept'); return; }
      showAlert('Accepted', `You can now view ${username}'s bookmarks`);
    } catch { showAlert('Error', 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const handleDenyRequest = async (requestId, username) => {
    setLoading(true);
    try {
      const { error } = await denyShareRequest(requestId);
      if (error) { showAlert('Error', error.message || 'Failed to deny'); return; }
      showAlert('Denied', `Denied request from ${username}`);
    } catch { showAlert('Error', 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const openEditModal = (perm) => {
    setEditingPermission(perm);
    setSelectedFolderIds(perm.share_all ? myFolders.map(f => f.id) : (perm.folder_ids || []));
    setEditModalVisible(true);
  };

  const handleUpdateFolders = async () => {
    if (!editingPermission) return;
    setLoading(true);
    try {
      const { error } = await updateSharedFolders(editingPermission.id, selectedFolderIds);
      if (error) { showAlert('Error', error.message || 'Failed to update'); return; }
      showAlert('Updated', 'Folder permissions updated');
      setEditModalVisible(false); setEditingPermission(null); setSelectedFolderIds([]);
      await loadMyFolders();
    } catch { showAlert('Error', 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const toggleFolder = (id) =>
    setSelectedFolderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Account ── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person-outline" size={28} color={colors.label} />
          </View>
          <Text style={[styles.emailText, { color: colors.text }]}>{user?.email || 'Not signed in'}</Text>
          <Text style={[styles.sectionLabel, { color: colors.label }]}>Your account</Text>
        </View>

        {/* ── Pending requests ── */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Pending Requests
              <Text style={{ color: colors.label }}> ({pendingRequests.length})</Text>
            </Text>
            {pendingRequests.map((req) => (
              <View key={req.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.cardName, { color: colors.text }]}>{req.username} wants to share</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.actionButton, flex: 1 }]}
                    onPress={() => handleAcceptRequest(req.id, req.username)}
                    disabled={loading}
                  >
                    <Text style={[styles.primaryBtnText, { color: colors.actionButtonText }]}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ghostBtn, { borderColor: colors.inputBorder, flex: 1 }]}
                    onPress={() => handleDenyRequest(req.id, req.username)}
                    disabled={loading}
                  >
                    <Text style={[styles.ghostBtnText, { color: colors.label }]}>Deny</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Profiles I'm viewing ── */}
        {sharedProfiles.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Viewing
              <Text style={{ color: colors.label }}> ({sharedProfiles.length})</Text>
            </Text>
            {sharedProfiles.map((sp) => {
              const isActive = activeProfileId === sp.owner_id;
              return (
                <TouchableOpacity
                  key={sp.id}
                  onPress={() => switchActiveProfile(sp.owner_id)}
                  style={[
                    styles.card,
                    {
                      backgroundColor: isActive ? colors.actionButton : colors.card,
                      borderColor: isActive ? colors.actionButton : colors.cardBorder,
                      flexDirection: 'row', alignItems: 'center',
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: isActive ? colors.actionButtonText : colors.text }]}>
                      {sp.username}
                    </Text>
                    {isActive && (
                      <Text style={{ color: colors.actionButtonText, fontSize: 11, fontFamily: 'Quicksand_400Regular', marginTop: 2 }}>
                        Currently viewing
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => { setSelectedSharedProfile(sp); setSharedProfileMenuVisible(true); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={isActive ? colors.actionButtonText : colors.label} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
            {activeProfileId && activeProfileId !== user?.id && (
              <TouchableOpacity
                style={[styles.ghostBtn, { borderColor: colors.inputBorder }]}
                onPress={() => switchActiveProfile(null)}
              >
                <Text style={[styles.ghostBtnText, { color: colors.label }]}>Switch back to my profile</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Shared with ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Shared With
            <Text style={{ color: colors.label }}> ({sharedPermissions.length})</Text>
          </Text>

          {sharedPermissions.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: colors.inputBorder }]}>
              <Ionicons name="people-outline" size={32} color={colors.inputBorder} />
              <Text style={[styles.emptyText, { color: colors.label }]}>Not sharing with anyone yet</Text>
            </View>
          ) : (
            sharedPermissions.map((perm) => (
              <TouchableOpacity
                key={perm.id}
                onPress={() => openEditModal(perm)}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center' }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: colors.text }]}>{perm.email || perm.viewer_id}</Text>
                  <StatusBadge status={perm.status} />
                </View>
                <TouchableOpacity
                  onPress={() => { setSelectedPermission(perm); setSettingsMenuVisible(true); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.label} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.actionButton, marginTop: 8 }]}
            onPress={() => setShareModalVisible(true)}
          >
            <Ionicons name="person-add-outline" size={16} color={colors.actionButtonText} style={{ marginRight: 8 }} />
            <Text style={[styles.primaryBtnText, { color: colors.actionButtonText }]}>Share with someone</Text>
          </TouchableOpacity>
        </View>

        {/* ── Danger zone ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <TouchableOpacity
            style={[styles.ghostBtn, { borderColor: colors.inputBorder }]}
            onPress={() => setBlockedModalVisible(true)}
          >
            <Ionicons name="ban-outline" size={16} color={colors.label} style={{ marginRight: 8 }} />
            <Text style={[styles.ghostBtnText, { color: colors.label }]}>
              Blocked profiles {blockedEmails.length > 0 ? `(${blockedEmails.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Share modal ── */}
      <Sheet visible={shareModalVisible} onClose={() => { setShareModalVisible(false); setShareEmail(''); }}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Share your profile</Text>
          <Text style={[styles.modalSub, { color: colors.label }]}>They'll get a request to accept first</Text>
          <TextInput
            value={shareEmail}
            onChangeText={setShareEmail}
            placeholder="Email address"
            placeholderTextColor={colors.label}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
          />
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: colors.inputBorder, flex: 1 }]}
              onPress={() => { setShareModalVisible(false); setShareEmail(''); }}
              disabled={loading}
            >
              <Text style={[styles.ghostBtnText, { color: colors.label }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.actionButton, flex: 1, opacity: loading || !shareEmail.trim() ? 0.5 : 1 }]}
              onPress={handleShare}
              disabled={loading || !shareEmail.trim()}
            >
              <Text style={[styles.primaryBtnText, { color: colors.actionButtonText }]}>
                {loading ? 'Sending…' : 'Send Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Sheet>

      {/* ── Permission settings menu ── */}
      <Sheet visible={settingsMenuVisible} onClose={() => setSettingsMenuVisible(false)}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedPermission?.email || 'User'}</Text>
          <View style={{ height: 1, backgroundColor: colors.inputBorder, marginBottom: 12 }} />
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => { setSettingsMenuVisible(false); openEditModal(selectedPermission); }}
          >
            <Ionicons name="folder-outline" size={18} color={colors.label} style={{ marginRight: 12 }} />
            <Text style={[styles.menuRowText, { color: colors.text }]}>Manage folders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => { setSettingsMenuVisible(false); handleUnshare(selectedPermission?.email); }}
          >
            <Ionicons name="person-remove-outline" size={18} color={colors.label} style={{ marginRight: 12 }} />
            <Text style={[styles.menuRowText, { color: colors.text }]}>Unshare</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              setSettingsMenuVisible(false);
              const email = selectedPermission?.email;
              if (email && !blockedEmails.includes(email)) {
                setBlockedEmails([...blockedEmails, email]);
                handleUnshare(email);
                showAlert('Blocked', `${email} has been blocked`);
              }
            }}
          >
            <Ionicons name="ban-outline" size={18} color="#d72660" style={{ marginRight: 12 }} />
            <Text style={[styles.menuRowText, { color: '#d72660' }]}>Block user</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSettingsMenuVisible(false)} style={{ alignItems: 'center', paddingTop: 14 }}>
            <Text style={{ color: colors.label, fontFamily: 'Quicksand_400Regular', fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Sheet>

      {/* ── Shared profile menu ── */}
      <Sheet visible={sharedProfileMenuVisible} onClose={() => setSharedProfileMenuVisible(false)}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedSharedProfile?.username}</Text>
          <View style={{ height: 1, backgroundColor: colors.inputBorder, marginBottom: 12 }} />
          <TouchableOpacity
            style={styles.menuRow}
            onPress={async () => {
              setSharedProfileMenuVisible(false);
              setLoading(true);
              try {
                const { error } = await denyShareRequest(selectedSharedProfile.id);
                if (error) { showAlert('Error', error.message || 'Failed'); return; }
                if (activeProfileId === selectedSharedProfile.owner_id) switchActiveProfile(null);
                showAlert('Removed', `Removed ${selectedSharedProfile.username}`);
              } catch { showAlert('Error', 'Something went wrong'); }
              finally { setLoading(false); }
            }}
          >
            <Ionicons name="person-remove-outline" size={18} color="#d72660" style={{ marginRight: 12 }} />
            <Text style={[styles.menuRowText, { color: '#d72660' }]}>Remove shared profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSharedProfileMenuVisible(false)} style={{ alignItems: 'center', paddingTop: 14 }}>
            <Text style={{ color: colors.label, fontFamily: 'Quicksand_400Regular', fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Sheet>

      {/* ── Edit folder permissions ── */}
      <Sheet visible={editModalVisible} onClose={() => { setEditModalVisible(false); setEditingPermission(null); }}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, maxHeight: '80%' }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Folder sharing</Text>
          <Text style={[styles.modalSub, { color: colors.label }]}>
            {editingPermission?.email} · Home always shared
          </Text>
          <ScrollView style={{ maxHeight: 280, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
            {myFolders.length === 0 ? (
              <Text style={{ color: colors.label, fontFamily: 'Quicksand_400Regular', textAlign: 'center', marginTop: 12 }}>No folders yet</Text>
            ) : myFolders.map((folder) => {
              const isSelected = selectedFolderIds.includes(folder.id);
              return (
                <TouchableOpacity
                  key={folder.id}
                  onPress={() => toggleFolder(folder.id)}
                  style={[styles.folderRow, {
                    backgroundColor: colors.inputBackground,
                    borderColor: isSelected ? colors.actionButton : colors.inputBorder,
                  }]}
                >
                  <View style={[styles.checkbox, { borderColor: isSelected ? colors.actionButton : colors.label }, isSelected && { backgroundColor: colors.actionButton }]}>
                    {isSelected && <Ionicons name="checkmark" size={13} color={colors.actionButtonText} />}
                  </View>
                  <Text style={{ color: colors.text, flex: 1, fontFamily: 'Quicksand_400Regular', fontSize: 15 }}>{folder.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: colors.inputBorder, flex: 1 }]}
              onPress={() => { setEditModalVisible(false); setEditingPermission(null); }}
              disabled={loading}
            >
              <Text style={[styles.ghostBtnText, { color: colors.label }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.actionButton, flex: 1, opacity: loading ? 0.5 : 1 }]}
              onPress={handleUpdateFolders}
              disabled={loading}
            >
              <Text style={[styles.primaryBtnText, { color: colors.actionButtonText }]}>
                {loading ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Sheet>

      {/* ── Blocked profiles ── */}
      <Sheet visible={blockedModalVisible} onClose={() => setBlockedModalVisible(false)}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, maxHeight: '80%' }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Blocked profiles</Text>
          <TextInput
            value={blockEmail}
            onChangeText={setBlockEmail}
            placeholder="Email to block"
            placeholderTextColor={colors.label}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.actionButton, marginBottom: 16, opacity: blockEmail.trim() ? 1 : 0.4 }]}
            onPress={() => {
              if (blockEmail.trim() && !blockedEmails.includes(blockEmail.trim())) {
                setBlockedEmails([...blockedEmails, blockEmail.trim()]);
                setBlockEmail('');
              }
            }}
            disabled={!blockEmail.trim()}
          >
            <Text style={[styles.primaryBtnText, { color: colors.actionButtonText }]}>Block</Text>
          </TouchableOpacity>
          <ScrollView style={{ maxHeight: 200, marginBottom: 12 }} showsVerticalScrollIndicator={false}>
            {blockedEmails.length === 0 ? (
              <Text style={{ color: colors.label, textAlign: 'center', fontFamily: 'Quicksand_400Regular' }}>No blocked profiles</Text>
            ) : blockedEmails.map((email, idx) => (
              <View key={idx} style={[styles.folderRow, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <Text style={{ color: colors.text, flex: 1, fontFamily: 'Quicksand_400Regular', fontSize: 14 }}>{email}</Text>
                <TouchableOpacity onPress={() => setBlockedEmails(blockedEmails.filter(e => e !== email))}>
                  <Ionicons name="close" size={18} color="#d72660" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.ghostBtn, { borderColor: colors.inputBorder }]} onPress={() => setBlockedModalVisible(false)}>
            <Text style={[styles.ghostBtnText, { color: colors.label }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </Sheet>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Quicksand_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(128,128,128,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    alignSelf: 'center',
  },
  emailText: {
    fontSize: 15,
    fontFamily: 'Quicksand_600SemiBold',
    textAlign: 'center',
  },
  cardName: {
    fontSize: 15,
    fontFamily: 'Quicksand_600SemiBold',
    marginBottom: 4,
  },
  emptyState: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  emptyText: {
    fontFamily: 'Quicksand_400Regular',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'Quicksand_600SemiBold',
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  ghostBtnText: {
    fontSize: 14,
    fontFamily: 'Quicksand_500Medium',
  },

  // Modals
  modalCard: {
    borderRadius: 20,
    padding: 24,
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    fontFamily: 'Quicksand_400Regular',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontFamily: 'Quicksand_400Regular',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuRowText: {
    fontSize: 15,
    fontFamily: 'Quicksand_500Medium',
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
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
});