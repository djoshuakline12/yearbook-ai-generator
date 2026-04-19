/**
 * Session Store
 *
 * In-memory store for keeping photo data and layout state between requests.
 * Allows the chatbot to modify layouts without re-uploading photos.
 * Sessions auto-expire after 30 minutes.
 */

const crypto = require('crypto');
const fs = require('fs');

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessions = new Map();

/**
 * Create a new session from processed photo results and layout data
 */
function createSession(photoResults, layout, pageContent, theme, pageType) {
  const sessionId = crypto.randomUUID();

  // Read processed photos into base64 so they survive file cleanup
  const photos = photoResults.map((photo, index) => {
    let base64;
    try {
      const imgData = fs.readFileSync(photo.processedPath);
      base64 = imgData.toString('base64');
    } catch (err) {
      console.error(`Session store - Failed to read photo ${index}:`, err.message);
      base64 = null;
    }

    return {
      index,
      base64,
      orientation: photo.orientation,
      aspectRatio: photo.aspectRatio,
      width: photo.width,
      height: photo.height,
      focalPoint: photo.focalPoint || null,
      objectPosition: photo.objectPosition || null,
    };
  });

  const session = {
    id: sessionId,
    createdAt: Date.now(),
    photos,
    layout,
    pageContent,
    theme,
    pageType,
  };

  // Clean up expired sessions before adding new one
  cleanupExpired();

  sessions.set(sessionId, session);
  console.log(`Session created: ${sessionId} (${photos.length} photos, expires in 30min)`);

  return sessionId;
}

/**
 * Get a session by ID, returns null if expired or not found
 */
function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Check TTL
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    console.log(`Session expired: ${sessionId}`);
    return null;
  }

  return session;
}

/**
 * Update the layout in an existing session
 */
function updateLayout(sessionId, newLayout) {
  const session = getSession(sessionId);
  if (!session) return false;

  session.layout = newLayout;
  return true;
}

/**
 * Remove expired sessions
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
      console.log(`Session cleaned up: ${id}`);
    }
  }
}

/**
 * Get just the layout from a session
 */
function getLayout(sessionId) {
  const session = getSession(sessionId);
  if (!session) return null;
  return {
    layout: session.layout,
    pageType: session.pageType,
    photoCount: session.photos.length,
  };
}

/**
 * Get photo metadata and base64 data for the editor
 */
function getPhotos(sessionId) {
  const session = getSession(sessionId);
  if (!session) return null;
  return session.photos.map(p => ({
    index: p.index,
    base64: p.base64,
    width: p.width,
    height: p.height,
    aspectRatio: p.aspectRatio,
    orientation: p.orientation,
    focalPoint: p.focalPoint,
  }));
}

/**
 * Replace the elements array in a session's layout
 */
function setLayout(sessionId, elements) {
  const session = getSession(sessionId);
  if (!session) return false;
  session.layout.elements = elements;
  return true;
}

/**
 * Get active session count (for monitoring)
 */
function getActiveCount() {
  cleanupExpired();
  return sessions.size;
}

module.exports = {
  createSession,
  getSession,
  updateLayout,
  getActiveCount,
  getLayout,
  getPhotos,
  setLayout,
};
