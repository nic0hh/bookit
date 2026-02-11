// context/BookmarksContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { ProfilesContext } from "./ProfilesContext";

export const BookmarksContext = createContext();
const STORAGE_BUCKET = 'bookmark-images';

export function BookmarksProvider({ children }) {
  const profilesContext = useContext(ProfilesContext);
  console.log('📦 BookmarksProvider - ProfilesContext value:', profilesContext);
  
  const { effectiveProfileId, isViewingShared } = profilesContext || {};
  console.log('📦 BookmarksProvider - effectiveProfileId:', effectiveProfileId);
  console.log('📦 BookmarksProvider - isViewingShared:', isViewingShared);

  const [bookmarks, setBookmarks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------
  // Load bookmarks whenever effectiveProfileId changes
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!effectiveProfileId) {
      setBookmarks([]);
      setFolders([]);
      return;
    }

    reloadAll();
  }, [effectiveProfileId]);

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

      if (error) {
        console.error('loadFolders error:', error);
        setFolders([]);
        return [];
      }

      setFolders(data || []);
      return data || [];
    } catch (err) {
      console.error('loadFolders exception:', err);
      setFolders([]);
      return [];
    }
  }

  // ---------------------------------------------------------------
  // Fetch bookmarks for whichever profile is active
  // ---------------------------------------------------------------
  async function loadBookmarks() {
    if (!effectiveProfileId) return [];

    console.log("DEBUG loadBookmarks -> effectiveProfileId =", effectiveProfileId);

    setLoading(true);
    try {
      // Fetch bookmarks
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", effectiveProfileId)
        .order("created_at", { ascending: false });

      if (bookmarksError) {
        console.error("loadBookmarks error:", bookmarksError);
        setBookmarks([]);
        return [];
      }

      // Fetch folder relationships from junction table
      const { data: junctionData, error: junctionError } = await supabase
        .from("bookmark_folders")
        .select("bookmark_id, folder_id");

      if (junctionError) {
        console.error("loadBookmarks junction error:", junctionError);
      }

      // Map folder IDs to each bookmark
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
              .createSignedUrl(bookmark.image_path, 60 * 60);

            if (signedError) {
              console.error('createSignedUrl error:', signedError);
            } else {
              signedImageUrl = signedData?.signedUrl || signedImageUrl;
            }
          }

          return {
            ...bookmark,
            image: signedImageUrl,
            folder_ids: folderIds,
            // Keep folder_id for backward compatibility (use first folder or legacy value)
            folder_id: folderIds.length > 0 ? folderIds[0] : bookmark.folder_id,
          };
        })
      );

      console.log("DEBUG bookmarks count:", bookmarksWithFolders.length);
      if (bookmarksWithFolders[0]) {
        console.log("DEBUG first bookmark:", JSON.stringify(bookmarksWithFolders[0], null, 2));
        console.log("DEBUG image dimensions:", {
          width: bookmarksWithFolders[0].image_width,
          height: bookmarksWithFolders[0].image_height
        });
      }

      setBookmarks(bookmarksWithFolders);
      return bookmarksWithFolders;
    } catch (err) {
      console.error("loadBookmarks exception:", err);
      setBookmarks([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------
  // Add bookmark (only works for owner; shared viewers blocked)
  // ---------------------------------------------------------------
  async function addBookmark({ title, url, folderIds, folderId, image, imagePath, imageWidth, imageHeight, tags }) {
    if (!effectiveProfileId) return { error: "No profile selected" };
    if (isViewingShared)
      return { error: "Cannot add bookmarks to a shared profile" };

    // Support both folderIds array (new) and folderId single value (backward compat)
    const folders = folderIds || (folderId ? [folderId] : []);

    const insert = {
      user_id: effectiveProfileId,
      title,
      url,
      folder_id: folders.length > 0 ? folders[0] : null, // Keep legacy column
      image,
      image_path: imagePath,
      image_width: imageWidth,
      image_height: imageHeight,
      tags,
    };

    const { data, error } = await supabase
      .from("bookmarks")
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error("addBookmark error:", error);
      return { error };
    }

    // Insert into junction table for each folder
    if (folders.length > 0) {
      const junctionInserts = folders.map(fId => ({
        bookmark_id: data.id,
        folder_id: fId
      }));

      const { error: junctionError } = await supabase
        .from("bookmark_folders")
        .insert(junctionInserts);

      if (junctionError) {
        console.error("addBookmark junction error:", junctionError);
      }
    }

    await reloadAll();
    return { data };
  }

  // ---------------------------------------------------------------
  // Delete bookmark (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function deleteBookmark(id) {
    console.log('=== deleteBookmark called with id:', id);
    console.log('effectiveProfileId:', effectiveProfileId);
    console.log('isViewingShared:', isViewingShared);
    
    if (isViewingShared) {
      console.log('❌ Blocked: viewing shared profile');
      return { error: "Cannot delete bookmarks from a shared profile" };
    }

    if (!effectiveProfileId) {
      console.log('❌ No effectiveProfileId - cannot delete');
      return { error: "No profile ID available" };
    }

    console.log('Calling Supabase delete...');
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id);

    console.log('Supabase response - error:', error);

    if (error) {
      console.error("❌ deleteBookmark error:", error);
      return { error };
    }

    console.log('✅ Delete successful, calling reloadAll...');
    await reloadAll();
    console.log('Returning null (success)');
    return null;
  }

  // ---------------------------------------------------------------
  // Update bookmark (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function updateBookmark(id, updates) {
    if (isViewingShared)
      return { error: "Cannot update bookmarks in a shared profile" };

    // Support both folderIds array (new) and folderId single value (backward compat)
    const folders = updates.folderIds || (updates.folderId ? [updates.folderId] : []);

    const { error } = await supabase
      .from("bookmarks")
      .update({
        title: updates.title,
        url: updates.url,
        tags: updates.tags,
        folder_id: folders.length > 0 ? folders[0] : null, // Keep legacy column
        image: updates.image,
        image_path: updates.imagePath,
        image_width: updates.imageWidth,
        image_height: updates.imageHeight,
        image_position_x: updates.imagePositionX,
        image_position_y: updates.imagePositionY,
      })
      .eq("id", id);

    if (error) {
      console.error("updateBookmark error:", error);
      return error.message || "Update failed";
    }

    // Update junction table if folderIds provided
    if (updates.folderIds !== undefined) {
      // Delete existing folder relationships
      await supabase
        .from("bookmark_folders")
        .delete()
        .eq("bookmark_id", id);

      // Insert new relationships
      if (folders.length > 0) {
        const junctionInserts = folders.map(fId => ({
          bookmark_id: id,
          folder_id: fId
        }));

        const { error: junctionError } = await supabase
          .from("bookmark_folders")
          .insert(junctionInserts);

        if (junctionError) {
          console.error("updateBookmark junction error:", junctionError);
        }
      }
    }

    await reloadAll();
    return null;
  }

  // ---------------------------------------------------------------
  // Add folder (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function addFolder(name) {
    if (isViewingShared)
      return { error: "Cannot add folders to a shared profile" };

    const { error } = await supabase
      .from("folders")
      .insert({
        user_id: effectiveProfileId,
        name,
        hidden: false,
      });

    if (error) {
      console.error("addFolder error:", error);
      return error.message || "Add folder failed";
    }

    reloadAll();
    return null;
  }

  // ---------------------------------------------------------------
  // Edit folder name (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function editFolder(id, newName) {
    if (isViewingShared)
      return { error: "Cannot edit folders in a shared profile" };

    const { error } = await supabase
      .from("folders")
      .update({ name: newName })
      .eq("id", id);

    if (error) {
      console.error("editFolder error:", error);
      return error.message || "Edit folder failed";
    }

    reloadAll();
    return null;
  }

  // ---------------------------------------------------------------
  // Remove folder (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function removeFolder(id) {
    if (isViewingShared)
      return { error: "Cannot remove folders from a shared profile" };

    const { error } = await supabase
      .from("folders")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("removeFolder error:", error);
      return error.message || "Remove folder failed";
    }

    reloadAll();
    return null;
  }

  // ---------------------------------------------------------------
  // Move folder up/down (blocked for shared viewers)
  // ---------------------------------------------------------------
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

  // ---------------------------------------------------------------
  // Set folder hidden status (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function setFolderHidden(id, hidden) {
    if (isViewingShared)
      return { error: "Cannot modify folders in a shared profile" };

    const { error } = await supabase
      .from("folders")
      .update({ hidden })
      .eq("id", id);

    if (error) {
      console.error("setFolderHidden error:", error);
      return error.message || "Update folder visibility failed";
    }

    reloadAll();
    return null;
  }

  return (
    <BookmarksContext.Provider
      value={{
        bookmarks,
        folders,
        loading,
        reloadAll,
        addBookmark,
        deleteBookmark,
        updateBookmark,
        addFolder,
        editFolder,
        removeFolder,
        moveFolder,
        setFolderHidden,
      }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}
