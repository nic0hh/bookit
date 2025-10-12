// context/BookmarksContext.js
import { supabase } from '../supabaseClient';
import { AuthContext } from './AuthContext';
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// storage bucket name (adjust if different)
const STORAGE_BUCKET = 'bookmark-images';

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

  // Prevent reshuffle when applying realtime sync updates
  const suppressShuffleRef = React.useRef(false);

  // ---- Remote loaders ----
  const loadFolders = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', user.id)                // <-- ensure we fetch only this user's folders
      .order('position', { ascending: true });
    if (error) {
      console.log('loadFolders error', error);
      return;
    }
    if (data) {
      setFolders(data.map(f => ({
        id: f.id,
        name: f.name,
        position: f.position,
        hidden: !!f.hidden_on_home,
      })));
    }
  }, [user]);

  const loadBookmarks = useCallback(async () => {
    if (!user) {
      console.log('loadBookmarks: no user');
      return;
    }

    console.log('DEBUG loadBookmarks: user object =', user);

    // Debug supabase auth state (v2)
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      console.log('DEBUG supabase.auth.getSession =>', sessionData, sessionErr);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      console.log('DEBUG supabase.auth.getUser =>', userData, userErr);
    } catch(e) {
      console.log('DEBUG auth check error', e);
    }
    console.log('AuthContext user.id =', user.id);

    // Debug: fetch a few rows without a user filter to see if the table has data reachable from device
    try {
      const { data: allRows, error: allErr } = await supabase.from('bookmarks').select('*').limit(5);
      console.log('DEBUG all bookmarks (no filter) => err:', allErr, 'rows:', allRows?.length, allRows?.slice(0,3));
    } catch (e) {
      console.log('DEBUG fetch all bookmarks error', e);
    }

    console.log('loadBookmarks: fetching for user', user.id);
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('loadBookmarks error', error);
      return;
    }

    if (data) {
      console.log('loadBookmarks: got rows=', data.length);
      const formatted = data.map(row => ({
        id: row.id,
        url: row.url,
        title: row.title,
        image: row.image,
        imagePath: row.image_path || null,
        tags: row.tags || [],
        folderId: row.folder_id || null,
      }));

      // Filter out any leftover blob/blon images from old saves
      formatted.forEach(b => {
        if (b.image && (/^(blob:|blon:)/i).test(String(b.image))) {
          console.log('Removing invalid blob image', b.image);
          b.image = null;
        }
      });

      // Refresh signed URLs for private bucket objects (non-blocking but awaited here)
      await Promise.all(formatted.map(async (b) => {
        if (b.imagePath) {
          try {
            const { data: urlData, error: urlErr } = await supabase
              .storage
              .from(STORAGE_BUCKET)
              .createSignedUrl(b.imagePath, 60 * 60); // 1 hour
            if (!urlErr && urlData?.signedUrl) {
              b.image = urlData.signedUrl;
            } else if (urlErr) {
              console.warn('createSignedUrl error', urlErr);
            }
          } catch (e) {
            console.warn('signed url refresh failed', e);
          }
        }
      }));

    setBookmarks(formatted);

      setShuffledBookmarks(prev => {
        // If it's the first load OR we are NOT in a realtime sync, reshuffle.
        if (!prev.length || !suppressShuffleRef.current) {
          return shuffleArray(formatted);
        }

        // Otherwise (realtime sync) merge into existing shuffled order without reshuffling.
        return prev.map(shuf => {
          if (shuf.id === lastEditId) {
            // Protect local edit from being overwritten
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
    console.log('BookmarksProvider mounted/updated, user=', user ? user.id : null);
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

  // Toggle whether a folder (and its bookmarks) are shown on the Home page
  async function setFolderHidden(folderId, hidden) {
    if (!user) return 'Not signed in';
    try {
      const { error } = await supabase
        .from('folders')
        .update({ hidden_on_home: hidden })
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (error) return error.message || 'Failed to update folder';

      // update local folders state immediately
      setFolders(prev => prev.map(f => (f.id === folderId ? { ...f, hidden } : f)));

      // refresh bookmarks to immediately reflect hidden folders on Home
      try {
        await loadBookmarks();
      } catch (e) {
        console.warn('reload after setFolderHidden failed', e);
      }

      return null;
    } catch (e) {
      console.warn('setFolderHidden error', e);
      return 'Failed to update folder';
    }
  }

  // ---- Bookmark CRUD ----
  async function addBookmark({ url, title, image, tags = [], folderId = null }) {
    if (!user) return 'Not signed in';
    const valid = validateUrl(url);
    if (!valid) return 'Invalid URL';
    // If image is a blob: URL (web upload), upload it to storage first
    let imageUrlToStore = image || null;
    let imagePathToStore = null;
    if (image && typeof image === 'string' && image.startsWith('blob:')) {
      try {
        const res = await fetch(image);
        const blob = await res.blob();
        const fileName = `${Date.now()}.jpg`;
        const filePath = `${user.id}/${Date.now()}-${fileName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' });

        console.log('addBookmark: upload result', { uploadData, uploadErr, filePath });

        if (uploadErr) {
          console.error('Image upload failed:', uploadErr);
        } else {
          // create signed URL for immediate use
          const { data: urlData, error: urlErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(filePath, 60 * 60);
          console.log('addBookmark: createSignedUrl', { urlData, urlErr });
          if (!urlErr && urlData?.signedUrl) imageUrlToStore = urlData.signedUrl;
          imagePathToStore = filePath;
        }
      } catch (e) {
        console.error('Blob conversion/upload failed:', e);
      }
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .insert({
        url: valid,
        title: (title || '').slice(0, 300),
        image: imageUrlToStore,
        image_path: imagePathToStore,
        tags,
        folder_id: folderId || null,
        user_id: user.id
      })
       .select()
       .single();
    console.log('addBookmark: insert result', { data, error });
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
      let imageUrl = partial.image || null;

      // If a blob: URL was provided (web preview), upload it to Supabase Storage.
      // Change STORAGE_BUCKET to 'bookmark-images' if your bucket name differs.
      const STORAGE_BUCKET = 'bookmark-images';
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('blob:')) {
        try {
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          const fileName = `bookmark_${id}_${Date.now()}.jpg`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
          console.log('updateBookmark: upload result', { uploadData, uploadErr, filePath });
          if (uploadErr) {
            console.error('Image upload failed:', uploadErr);
          } else {
            // create a signed URL to use immediately
            const { data: urlData, error: urlErr } = await supabase.storage
              .from(STORAGE_BUCKET)
              .createSignedUrl(filePath, 60 * 60);
            console.log('updateBookmark: createSignedUrl', { urlData, urlErr });
            if (!urlErr && urlData?.signedUrl) imageUrl = urlData.signedUrl;
            imagePath = filePath;
          }
        } catch (e) {
          console.error('Blob conversion/upload failed:', e);
        }
      }

      patch.image = imageUrl;
      localPatch.image = imageUrl;
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
      // Apply only the localPatch to avoid overwriting server fields and
      // force a new array reference for shuffledBookmarks so lists re-render.
      setBookmarks(prev => prev.map(b => (b.id === id ? { ...b, ...localPatch } : b)));
      setShuffledBookmarks(prev => {
        const updatedList = prev.map(b => (b.id === id ? { ...b, ...localPatch } : b));
        return [...updatedList];
      });

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
    console.log('🗑 deleteBookmark CALLED with id:', id);
    if (!user) {
      console.log('deleteBookmark: no user');
      return 'Not signed in';
    }

    try {
      // Attempt delete scoped to current user (RLS-safe)
      const { data, error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('deleteBookmark error', error);
        // show on-screen for quick debugging (remove in production)
        try { Alert.alert('Delete failed', JSON.stringify(error)); } catch {}
        return error?.message || 'Failed to delete bookmark';
      }

      // If DB returned the deleted row with image_path, try to remove storage object
      const imagePath = data?.image_path || null;
      if (imagePath) {
        try {
          const { error: removeErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([imagePath]);
          if (removeErr) {
            console.warn('deleteBookmark: failed to remove storage object', removeErr);
          }
        } catch (e) {
          console.warn('deleteBookmark: storage removal exception', e);
        }
      }

      // Update local state
      setBookmarks(prev => prev.filter(b => b.id !== id));
      setShuffledBookmarks(prev => prev.filter(b => b.id !== id));
      console.log('✅ Bookmark deleted', id);
      return null;
    } catch (e) {
      console.error('deleteBookmark exception', e);
      try { Alert.alert('Delete exception', String(e)); } catch {}
      return e?.message || 'Failed to delete bookmark';
    }
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
        async (payload) => {
          console.log('supabase bookmarks payload', payload, 'lastEditId=', lastEditId);
          if (payload.new?.id === lastEditId) {
            console.log('Skipping reload for self-edit');
            setLastEditId(null);
            return;
          }

          // Mark that this is a realtime sync so loadBookmarks won't reshuffle
          suppressShuffleRef.current = true;
          try {
            await loadBookmarks();
          } finally {
            suppressShuffleRef.current = false;
          }
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
    // add the function here:
    setFolderHidden,
    addFolder,
    editFolder,
    removeFolder,
    moveFolder,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    reloadAll: () => {
      if (user) {
        suppressShuffleRef.current = false;
        loadFolders();
        loadBookmarks();
      }
    },
  };

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}