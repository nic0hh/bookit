import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AuthContext } from './AuthContext';

export const ProfilesContext = createContext();

export function ProfilesProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [sharedProfiles, setSharedProfiles] = useState([]); // profiles shared with me (accepted)
  const [pendingRequests, setPendingRequests] = useState([]); // pending share requests I received
  const [sharedPermissions, setSharedPermissions] = useState([]); // profiles I have shared
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [loading, setLoading] = useState(false);

  // ------------------------------------------------------------------
  // 🧩 Load profile and sharing info when user changes
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setSharedProfiles([]);
      setPendingRequests([]);
      setSharedPermissions([]);
      return;
    }

    (async () => {
      setLoading(true);

      try {
        // Ensure profile exists
        const username = user.email ? user.email.split('@')[0] : null;
        await supabase.from('profiles').upsert(
          { id: user.id, username },
          { returning: 'minimal' }
        );

        // Load my own profile
        const { data: myProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(myProfile || null);

        // Load profiles that shared *with me* (accepted only)
        await loadSharedProfiles();

        // Load pending requests I received
        await loadPendingRequests();

        // Load profiles I've shared *with others*
        await loadSharedPermissions();
      } catch (err) {}

      setLoading(false);
    })();
  }, [user]);

  // ------------------------------------------------------------------
  // 🧭 Load accepted profiles shared *with me*
  // ------------------------------------------------------------------
  async function loadSharedProfiles() {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('shared_permissions')
        .select(`
          id,
          owner_id,
          viewer_id,
          status,
          share_all,
          share_home,
          folder_ids,
          created_at,
          profiles:owner_id (
            id,
            username
          )
        `)
        .eq('viewer_id', user.id)
        .eq('status', 'accepted');

      if (error) {
        setSharedProfiles([]);
        return [];
      }

      const normalized = (data || []).map((r) => ({
        id: r.id,
        owner_id: r.owner_id,
        username: r.profiles?.username || 'Unknown',
        share_all: r.share_all,
        share_home: r.share_home,
        folder_ids: r.folder_ids || [],
        created_at: r.created_at,
      }));

      setSharedProfiles(normalized);
      return normalized;
    } catch (err) {
      setSharedProfiles([]);
      return [];
    }
  }

  // ------------------------------------------------------------------
  // 📬 Load pending share requests I received
  // ------------------------------------------------------------------
  async function loadPendingRequests() {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('shared_permissions')
        .select(`
          id,
          owner_id,
          viewer_id,
          status,
          share_all,
          share_home,
          folder_ids,
          created_at,
          profiles:owner_id (
            id,
            username
          )
        `)
        .eq('viewer_id', user.id)
        .eq('status', 'pending');

      if (error) {
        setPendingRequests([]);
        return [];
      }

      const normalized = (data || []).map((r) => ({
        id: r.id,
        owner_id: r.owner_id,
        username: r.profiles?.username || 'Unknown',
        share_all: r.share_all,
        share_home: r.share_home,
        folder_ids: r.folder_ids || [],
        created_at: r.created_at,
      }));

      setPendingRequests(normalized);
      return normalized;
    } catch (err) {
      setPendingRequests([]);
      return [];
    }
  }

  // ------------------------------------------------------------------
  // ✅ Accept a pending share request
  // ------------------------------------------------------------------
  async function acceptShareRequest(requestId) {
    if (!user) return { error: 'Not signed in' };

    try {
      const { data, error } = await supabase.rpc('respond_to_share_request', {
        request_id: requestId,
        new_status: 'accepted',
      });

      if (error) {
        return { error };
      }

      if (data?.error) {
        return { error: data.error };
      }

      // Reload both lists
      await loadPendingRequests();
      await loadSharedProfiles();

      return { data };
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }

  // ------------------------------------------------------------------
  // ❌ Deny a pending share request
  // ------------------------------------------------------------------
  async function denyShareRequest(requestId) {
    if (!user) return { error: 'Not signed in' };

    try {
      const { data, error } = await supabase.rpc('respond_to_share_request', {
        request_id: requestId,
        new_status: 'denied',
      });

      if (error) {
        return { error };
      }

      if (data?.error) {
        return { error: data.error };
      }

      // Reload pending list
      await loadPendingRequests();

      return { data };
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }

  // ------------------------------------------------------------------
  // 🧭 Load profiles I have shared *with others*
  // ------------------------------------------------------------------
  async function loadSharedPermissions() {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('shared_permissions')
        .select(`
          id,
          viewer_id,
          viewer_email,
          status,
          share_all,
          share_home,
          folder_ids,
          created_at
        `)
        .eq('owner_id', user.id);

      if (error) {
        setSharedPermissions([]);
        return [];
      }

      const normalized = (data || []).map((r) => ({
        id: r.id,
        viewer_id: r.viewer_id,
        email: r.viewer_email || null,
        status: r.status,
        share_all: r.share_all,
        share_home: r.share_home,
        folder_ids: r.folder_ids || [],
        created_at: r.created_at,
      }));

      setSharedPermissions(normalized);
      return normalized;
    } catch (err) {
      setSharedPermissions([]);
      return [];
    }
  }

  // ------------------------------------------------------------------
  // 👇 Switch between my own or a shared profile
  // ------------------------------------------------------------------
  function switchActiveProfile(ownerId) {
    setActiveProfileId(ownerId);
  }

  // ------------------------------------------------------------------
  // 📁 Update which folders are shared with a specific user
  // ------------------------------------------------------------------
  async function updateSharedFolders(permissionId, folderIds) {
    if (!user) return { error: 'Not signed in' };

    try {

      const { data, error } = await supabase.rpc('update_shared_folders', {
        permission_id: permissionId,
        new_folder_ids: folderIds,
      });

      if (error) {
        return { error };
      }

      if (data?.error) {
        return { error: data.error };
      }

      // Reload shared permissions to reflect changes
      await loadSharedPermissions();

      return { data };
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }

  const isViewingShared = activeProfileId && activeProfileId !== user?.id;
  const effectiveProfileId = activeProfileId || user?.id;

  // ------------------------------------------------------------------
  // Return everything to context consumers
  // ------------------------------------------------------------------
  return (
    <ProfilesContext.Provider
      value={{
        profile,
        sharedProfiles,
        pendingRequests,
        sharedPermissions,
        loadSharedPermissions,
        loadPendingRequests,
        acceptShareRequest,
        denyShareRequest,
        updateSharedFolders,
        activeProfileId,
        setActiveProfileId,
        switchActiveProfile,
        isViewingShared,
        effectiveProfileId,
        loading,
      }}
    >
      {children}
    </ProfilesContext.Provider>
  );
}
