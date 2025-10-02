// context/BookmarksContext.js
import { supabase } from '../supabaseClient';
import { AuthContext } from './AuthContext';
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BookmarksContext = createContext();

function shuffleArray(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function BookmarksProvider({ children }) {
  const { user } = useContext(AuthContext);

  const [bookmarks, setBookmarks] = useState([]); // raw bookmarks
  const [shuffledBookmarks, setShuffledBookmarks] = useState([]); // shuffled bookmarks
  const [folders, setFolders] = useState([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [lastEditId, setLastEditId] = useState(null); // 👈 track recent edits

  // ---- Remote loaders ----
  const loadFolders = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('position', { ascending: true }); // <-- sort by position
    if (!error && data) {
      setFolders(data.map(f => ({
        id: f.id,
        name: f.name,
        position: f.position, // <-- include position
      })));
    }
  }, [user]);

  const loadBookmarks = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formatted = data.map(b => ({
        id: b.id,
        url: b.url,
        title: b.title,
        image: b.image,
        tags: b.tags || [],
        folderId: b.folder_id || null,
      }));

      setBookmarks(formatted);

      setShuffledBookmarks(prev => {
        if (!prev.length) return shuffleArray(formatted); // Only shuffle on first load or manual refresh

        return prev.map(shuf => {
          if (shuf.id === lastEditId) {
            // 👈 Protect local edit from being overwritten
            return shuf;
          }
          const fresh = formatted.find(b => b.id === shuf.id);
          return fresh ? { ...shuf, ...fresh } : shuf;
        });
      });
    }
  }, [user, lastEditId]);

  // Initial + user change
  useEffect(() => {
    if (!user) {
      setBookmarks([]);
      setShuffledBookmarks([]);
      setFolders([]);
      return;
    }
    (async () => {
      setLoadingRemote(true);
      await Promise.all([loadFolders(), loadBookmarks()]);
      setLoadingRemote(false);
    })();
  }, [user, loadFolders, loadBookmarks]);

  // ---- Helpers ----
  function validateUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
      const u = new URL(raw.trim());
      if (!['http:', 'https:'].includes(u.protocol)) return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  // ---- Folder CRUD ----
  async function addFolder(name) {
    if (!user) return 'Not signed in';
    const clean = name.trim().slice(0, 120);
    if (!clean) return 'Folder name required';
    // Find the next position value
    const nextPosition = folders.length > 0
      ? Math.max(...folders.map(f => f.position ?? 0)) + 1
      : 0;
    const { data, error } = await supabase
      .from('folders')
      .insert({ name: clean, user_id: user.id, position: nextPosition }) // <-- position is set here
      .select()
      .single();
    if (!error && data) {
      setFolders(prev => [...prev, { id: data.id, name: data.name, position: data.position }]);
      return null;
    }
    return error?.message || 'Failed to add folder';
  }

  async function editFolder(id, name) {
    if (!user) return 'Not signed in';
    const clean = name.trim().slice(0, 120);
    if (!clean) return 'Folder name required';

    const { error } = await supabase
      .from('folders')
      .update({ name: clean })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return error.message || 'Failed to update folder';

    setFolders(prev =>
      prev.map(f => (f.id === id ? { ...f, name: clean } : f))
    );

    return null;
  }

  async function removeFolder(id) {
    if (!user) return 'Not signed in';
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (!error) {
      setFolders(prev => prev.filter(f => f.id !== id));
      loadBookmarks();
      return null;
    }
    return error?.message || 'Failed to delete folder';
  }

  async function moveFolder(id, direction) {
    if (!user) return 'Not signed in';
    // Find current folder and its position
    const folder = folders.find(f => f.id === id);
    if (!folder) return 'Folder not found';

    // Sort folders by position
    const sorted = [...folders].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const idx = sorted.findIndex(f => f.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return 'Cannot move';

    const targetFolder = sorted[targetIdx];

    // Swap positions in Supabase
    const { error: err1 } = await supabase
      .from('folders')
      .update({ position: targetFolder.position })
      .eq('id', folder.id)
      .eq('user_id', user.id);

    const { error: err2 } = await supabase
      .from('folders')
      .update({ position: folder.position })
      .eq('id', targetFolder.id)
      .eq('user_id', user.id);

    if (err1 || err2) return err1?.message || err2?.message || 'Failed to move folder';

    // Reload folders to update UI
    await loadFolders();
    return null;
  }

  // ---- Bookmark CRUD ----
  async function addBookmark({ url, title, image, tags = [], folderId = null }) {
    if (!user) return 'Not signed in';
    const valid = validateUrl(url);
    if (!valid) return 'Invalid URL';
    const { data, error } = await supabase
      .from('bookmarks')
      .insert({
        url: valid,
        title: (title || '').slice(0, 300),
        image: image || null,
        tags,
        folder_id: folderId || null,
        user_id: user.id
      })
      .select()
      .single();
    if (!error && data) {
      const newBookmark = {
        id: data.id,
        url: data.url,
        title: data.title,
        image: data.image,
        tags: data.tags || [],
        folderId: data.folder_id,
      };
      setBookmarks(prev => [newBookmark, ...prev]);
      setShuffledBookmarks(prev => [newBookmark, ...prev]);
      return null;
    }
    return error?.message || 'Failed to add bookmark';
  }

  async function updateBookmark(id, partial) {
    if (!user) return 'Not signed in';
    const patch = {};
    const localPatch = {};

    if (partial.url) {
      const valid = validateUrl(partial.url);
      if (!valid) return 'Invalid URL';
      patch.url = valid;
      localPatch.url = valid;
    }
    if (partial.title !== undefined) {
      patch.title = partial.title.slice(0, 300);
      localPatch.title = partial.title.slice(0, 300);
    }
    if (partial.image !== undefined) {
      patch.image = partial.image || null;
      localPatch.image = partial.image || null;
    }
    if (partial.tags !== undefined) {
      patch.tags = partial.tags;
      localPatch.tags = partial.tags;
    }
    if (partial.folderId !== undefined) {
      patch.folder_id = partial.folderId;
      localPatch.folderId = partial.folderId;
    }

    if (Object.keys(patch).length === 0) return 'Nothing to update';

    const updated = { id, ...localPatch };

    const { error } = await supabase
      .from('bookmarks')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id);

    if (!error) {
      setBookmarks(prev =>
        prev.map(b => (b.id === id ? { ...b, ...updated } : b))
      );
      setShuffledBookmarks(prev =>
        prev.map(b => (b.id === id ? { ...b, ...updated } : b))
      );

      setLastEditId(id); // Protect this bookmark from being overwritten

      // Clear protection when Supabase confirms the update
      supabase
        .from('bookmarks')
        .select('id')
        .eq('id', id)
        .single()
        .then(() => setLastEditId(null));

      return null;
    }
    return error?.message || 'Failed to update bookmark';
  }

  async function deleteBookmark(id) {
    if (!user) return 'Not signed in';
    const { error } = await supabase.from('bookmarks').delete().eq('id', id);
    if (!error) {
      setBookmarks(prev => prev.filter(b => b.id !== id));
      setShuffledBookmarks(prev => prev.filter(b => b.id !== id));
      return null;
    }
    return error?.message || 'Failed to delete bookmark';
  }

  // --- Migration helpers ---
  async function getLocalBookmarks() {
    const raw = await AsyncStorage.getItem('localBookmarks');
    return raw ? JSON.parse(raw) : [];
  }
  async function clearLocalBookmarks() {
    await AsyncStorage.removeItem('localBookmarks');
  }
  async function getLocalFolders() {
    const raw = await AsyncStorage.getItem('localFolders');
    return raw ? JSON.parse(raw) : [];
  }
  async function clearLocalFolders() {
    await AsyncStorage.removeItem('localFolders');
  }

  // --- Migration effect ---
  useEffect(() => {
    if (!user) return;
    (async () => {
      const flagKey = `bookmarksMigrated_${user.id}`;
      const migrated = await AsyncStorage.getItem(flagKey);
      if (!migrated) {
        setMigrating(true);
        // 1. Migrate folders
        const localFolders = await getLocalFolders();
        const folderIdMap = {};
        if (localFolders && localFolders.length > 0) {
          for (const f of localFolders) {
            const { data, error } = await supabase
              .from('folders')
              .insert({ name: f.name })
              .select()
              .single();
            if (data && !error) {
              folderIdMap[f.id] = data.id;
            }
          }
          await clearLocalFolders();
        }

        // 2. Migrate bookmarks, remap folderId if needed
        const local = await getLocalBookmarks();
        if (local && local.length > 0) {
          for (const b of local) {
            let folderId = b.folderId || null;
            if (folderId && folderIdMap[folderId]) {
              folderId = folderIdMap[folderId];
            }
            await addBookmark({ ...b, folderId });
          }
          await clearLocalBookmarks();
        }
        await AsyncStorage.setItem(flagKey, '1');
        setMigrating(false);
      }
    })();
    // eslint-disable-next-line
  }, [user]);

  // Subscribe to bookmarks and folders changes
  useEffect(() => {
    if (!user) return;

    const bookmarksChannel = supabase
      .channel('public:bookmarks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookmarks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          // Ignore Supabase events for the bookmark we just updated
          if (payload.new?.id === lastEditId) return;
          loadBookmarks();
        }
      )
      .subscribe();

    const foldersChannel = supabase
      .channel('public:folders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folders', filter: `user_id=eq.${user.id}` },
        () => loadFolders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookmarksChannel);
      supabase.removeChannel(foldersChannel);
    };
  }, [user, loadBookmarks, loadFolders, lastEditId]);

  const value = {
    bookmarks,
    shuffledBookmarks,
    folders,
    loadingRemote,
    migrating,
    addFolder,
    editFolder,
    removeFolder,
    moveFolder,        // 👈 add this line
    addBookmark,
    updateBookmark,
    deleteBookmark,
    reloadAll: () => {
      if (user) {
        loadFolders();
        loadBookmarks();
      }
    },
  };

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}