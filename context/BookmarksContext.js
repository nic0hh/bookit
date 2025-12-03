// context/BookmarksContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { ProfilesContext } from "./ProfilesContext";

export const BookmarksContext = createContext();

export function BookmarksProvider({ children }) {
  const { effectiveProfileId, isViewingShared } = useContext(ProfilesContext);

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
      const { data, error } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", effectiveProfileId)
        .order("created_at", { ascending: false });

      console.log("DEBUG bookmarks fetched ->", { data, error });
      if (data) {
        console.log("DEBUG bookmarks count:", data.length);
        console.log("DEBUG first bookmark:", JSON.stringify(data[0], null, 2));
      } else {
        console.log("DEBUG bookmarks data is null/undefined");
      }
      if (error) {
        console.log("DEBUG bookmarks error:", JSON.stringify(error, null, 2));
      }

      if (error) {
        console.error("loadBookmarks error:", error);
        setBookmarks([]);
        return [];
      }

      setBookmarks(data || []);
      return data || [];
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
  async function addBookmark({ title, url, folder_id }) {
    if (!effectiveProfileId) return { error: "No profile selected" };
    if (isViewingShared)
      return { error: "Cannot add bookmarks to a shared profile" };

    const insert = {
      user_id: effectiveProfileId,
      title,
      url,
      folder_id,
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

    reloadAll();
    return { data };
  }

  // ---------------------------------------------------------------
  // Delete bookmark (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function deleteBookmark(id) {
    if (isViewingShared)
      return { error: "Cannot delete bookmarks from a shared profile" };

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("deleteBookmark error:", error);
      return { error };
    }

    reloadAll();
    return { error: null };
  }

  // ---------------------------------------------------------------
  // Update bookmark (blocked for shared viewers)
  // ---------------------------------------------------------------
  async function updateBookmark(id, updates) {
    if (isViewingShared)
      return { error: "Cannot update bookmarks in a shared profile" };

    const { error } = await supabase
      .from("bookmarks")
      .update({
        title: updates.title,
        url: updates.url,
        tags: updates.tags,
        folder_id: updates.folderId,
        image: updates.image,
      })
      .eq("id", id);

    if (error) {
      console.error("updateBookmark error:", error);
      return error.message || "Update failed";
    }

    reloadAll();
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
