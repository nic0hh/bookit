// utils/searchBookmarks.js
// Shared search filter used by HomeScreen and FolderBookmarksScreen so the two
// screens behave consistently: space-separated tokens, each token must match
// (as a substring) the title or at least one tag, all tokens required (AND).
export function filterBookmarksByQuery(bookmarks, query) {
  const tokens = (query || '').toLowerCase().split(' ').filter(Boolean);
  if (tokens.length === 0) return bookmarks;

  return bookmarks.filter(b => {
    const title = (b.title || '').toLowerCase();
    const tags = (b.tags || []).map(t => t.toLowerCase());
    return tokens.every(token =>
      title.includes(token) || tags.some(tag => tag.includes(token))
    );
  });
}
