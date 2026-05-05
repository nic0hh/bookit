// context/BookmarksContext.js
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { ProfilesContext } from "./ProfilesContext";

export const BookmarksContext = createContext();
const STORAGE_BUCKET = 'bookmark-images';
const SIGNED_URL_TTL = 60 * 60;           // 1 hour in seconds
const REFRESH_THRESHOLD = 50 * 60 * 1000; // refresh if < 50 min remaining (in ms)
const REFRESH_INTERVAL  = 10 * 60 * 1000; // check every 10 minutes

export function BookmarksProvider({ children }) {
  const profilesContext = useContext(ProfilesContext);
  const { effectiveProfileId, isViewingShared } = profilesContext || {};

  const [bookmarks, setBookmarks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Track when signed URLs were last generated (bookmark id → timestamp ms)
  const signedAtRef = useRef({});
  const refreshTimerRef = useRef(null);

  // ---------------------------------------------------------------
  // Load bookmarks whenever effectiveProfileId changes
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!effectiveProfileId) {
      setBookmarks([]);
      setFolders([]);
      signedAtRef.current = {};
      return;
    }
    reloadAll();
  }, [effectiveProfileId]);

  // ---------------------------------------------------------------
  // Auto-refresh signed URLs every 10 minutes
  // ---------------------------------------------------------------
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(() => {
      refreshExpiredSignedUrls();
    }, REFRESH_INTERVAL);
    return () => clearInterval(refreshTimerRef.current);
  }, []);

  async function refreshExpiredSignedUrls() {
    const now = Date.now();
    setBookmarks(prev => {
      const needsRefresh = prev.filter(b =>
        b.image_path &&
        (!signedAtRef.current[b.id] || now - signedAtRef.current[b.id] > REFRESH_THRESHOLD)
      );
      if (needsRefresh.length === 0) return prev;

      (async () => {
        const refreshed = await Promise.all(
          needsRefresh.map(async (b) => {
            const { data, error } = await supabase
              .storage
              .from(STORAGE_BUCKET)
              .createSignedUrl(b.image_path, SIGNED_URL_TTL);
            if (error || !data?.signedUrl) return null;
            signedAtRef.current[b.id] = Date.now();
            return { id: b.id, signedUrl: data.signedUrl };
          })
        );

        const updates = refreshed.filter(Boolean);
        if (updates.length === 0) return;

        setBookmarks(current =>
          current.map(b => {
            const update = updates.find(u => u.id === b.id);
            return update ? { ...b, image: update.signedUrl } : b;
          })
        );
      })();

      return prev;
    });
  }

  // ---------------------------------------------------------------
  // Load both folders and bookmarks
  // ---------------------------------------------------------------
  async function reloadAll() {
    if (!effectiveProfileId) return;
    setLoading(true);
    try {
      await Promise.all([loadFolders(), loadBookmarks()]);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------
  // Fetch folders for the active profile
  // ---------------------------------------------------------------
  async function loadFolders() {
    if (!effectiveProfileId) return [];
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', effectiveProfileId)
        .order('name', { ascending: true });

      if (error) { setFolders([]); return []; }
      setFolders(data || []);
      return data || [];
    } catch {
      setFolders([]);
      return [];
    }
  }

  // ---------------------------------------------------------------
  // Fetch bookmarks for whichever profile is active
  // ---------------------------------------------------------------
  async function loadBookmarks() {
    if (!effectiveProfileId) return [];

    setLoading(true);
    try {
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", effectiveProfileId)
        .order("created_at", { ascending: false });

      if (bookmarksError) { setBookmarks([]); return []; }

      const { data: junctionData } = await supabase
        .from("bookmark_folders")
        .select("bookmark_id, folder_id");

      const now = Date.now();
      const bookmarksWithFolders = await Promise.all(
        (bookmarksData || []).map(async (bookmark) => {
          const folderIds = (junctionData || [])
            .filter(j => j.bookmark_id === bookmark.id)
            .map(j => j.folder_id);

          let signedImageUrl = bookmark.image || null;
          if (bookmark.image_path) {
            const { data: signedData, error: signedError } = await supabase
              .storage
              .from(STORAGE_BUCKET)
              .createSignedUrl(bookmark.image_path, SIGNED_URL_TTL);

            if (!signedError && signedData?.signedUrl) {
              signedImageUrl = signedData.signedUrl;
              signedAtRef.current[bookmark.id] = now;
            }
          }

          return {
            ...bookmark,
            image: signedImageUrl,
            folder_ids: folderIds,
            folder_id: folderIds.length > 0 ? folderIds[0] : bookmark.folder_id,
            // notes is already included via the select("*") above
          };
        })
      );

      setBookmarks(bookmarksWithFolders);
      return bookmarksWithFolders;
    } catch {
      setBookmarks([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------
  // Add bookmark (only works for owner; shared viewers blocked)
  // ---------------------------------------------------------------
  async function addBookmark({ title, url, folderIds, folderId, image, imagePath, imageWidth, imageHeight, tags, notes }) {
    if (!effectiveProfileId) return { error: "No profile selected" };
    if (isViewingShared) return { error: "Cannot add bookmarks to a shared profile" };

    const resolvedFolders = folderIds || (folderId ? [folderId] : []);

    const { data, error } = await supabase
      .from("bookmarks")
      .insert({
        user_id: effectiveProfileId,
        title, url,
        folder_id: resolvedFolders.length > 0 ? resolvedFolders[0] : null,
        image, image_path: imagePath,
        image_width: imageWidth, image_height: imageHeight,
        tags,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return { error };

    if (resolvedFolders.length > 0) {
      await supabase.from("bookmark_folders").insert(
        resolvedFolders.map(fId => ({ bookmark_id: data.id, folder_id: fId }))
      );
    }

    await reloadAll();
    return { data };
  }

  // ---------------------------------------------------------------
  // Delete bookmark (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function deleteBookmark(id) {
    if (isViewingShared) return { error: "Cannot delete bookmarks from a shared profile" };
    if (!effectiveProfileId) return { error: "No profile ID available" };

    const { error } = await supabase.from("bookmarks").delete().eq("id", id);
    if (error) return { error };

    delete signedAtRef.current[id];
    await reloadAll();
    return null;
  }

  // ---------------------------------------------------------------
  // Update bookmark (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function updateBookmark(id, updates) {
    if (isViewingShared) return { error: "Cannot update bookmarks in a shared profile" };

    const resolvedFolders = updates.folderIds || (updates.folderId ? [updates.folderId] : []);

    const { error } = await supabase
      .from("bookmarks")
      .update({
        title: updates.title, url: updates.url, tags: updates.tags,
        notes: updates.notes ?? null,
        folder_id: resolvedFolders.length > 0 ? resolvedFolders[0] : null,
        image: updates.image, image_path: updates.imagePath,
        image_width: updates.imageWidth, image_height: updates.imageHeight,
        image_position_x: updates.imagePositionX, image_position_y: updates.imagePositionY,
      })
      .eq("id", id);

    if (error) return error.message || "Update failed";

    if (updates.folderIds !== undefined) {
      await supabase.from("bookmark_folders").delete().eq("bookmark_id", id);
      if (resolvedFolders.length > 0) {
        await supabase.from("bookmark_folders").insert(
          resolvedFolders.map(fId => ({ bookmark_id: id, folder_id: fId }))
        );
      }
    }

    await reloadAll();
    return null;
  }

  // ---------------------------------------------------------------
  // Folder operations (all blocked for shared viewers)
  // ---------------------------------------------------------------
  async function addFolder(name) {
    if (isViewingShared) return { error: "Cannot add folders to a shared profile" };
    const { error } = await supabase.from("folders").insert({ user_id: effectiveProfileId, name, hidden: false });
    if (error) return error.message || "Add folder failed";
    reloadAll();
    return null;
  }

  async function editFolder(id, newName) {
    if (isViewingShared) return { error: "Cannot edit folders in a shared profile" };
    const { error } = await supabase.from("folders").update({ name: newName }).eq("id", id);
    if (error) return error.message || "Edit folder failed";
    reloadAll();
    return null;
  }

  async function removeFolder(id) {
    if (isViewingShared) return { error: "Cannot remove folders from a shared profile" };
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) return error.message || "Remove folder failed";
    reloadAll();
    return null;
  }

  async function moveFolder(id, direction) {
    if (isViewingShared) return;
    const sortedFolders = [...folders].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const idx = sortedFolders.findIndex(f => f.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sortedFolders.length) return;
    const temp = sortedFolders[idx].position ?? idx;
    sortedFolders[idx].position = sortedFolders[targetIdx].position ?? targetIdx;
    sortedFolders[targetIdx].position = temp;
    await Promise.all([
      supabase.from("folders").update({ position: sortedFolders[idx].position }).eq("id", sortedFolders[idx].id),
      supabase.from("folders").update({ position: sortedFolders[targetIdx].position }).eq("id", sortedFolders[targetIdx].id),
    ]);
    reloadAll();
  }

  async function setFolderHidden(id, hidden) {
    if (isViewingShared) return { error: "Cannot modify folders in a shared profile" };
    const { error } = await supabase.from("folders").update({ hidden }).eq("id", id);
    if (error) return error.message || "Update folder visibility failed";
    reloadAll();
    return null;
  }

  return (
    <BookmarksContext.Provider
      value={{
        bookmarks, folders, loading, reloadAll,
        addBookmark, deleteBookmark, updateBookmark,
        addFolder, editFolder, removeFolder, moveFolder, setFolderHidden,
      }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}