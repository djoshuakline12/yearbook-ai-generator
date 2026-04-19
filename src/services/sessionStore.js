/**
 * Session Store with Disk Persistence
 *
 * Saves each session as a JSON file on disk so they survive:
 * - Browser refreshes
 * - Server restarts
 * - Deployments
 *
 * Sessions expire after 30 days (configurable via SESSION_TTL_DAYS env var).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SESSION_TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || '30', 10);
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

// Sessions are saved to disk in this directory
const SESSIONS_DIR = path.join(__dirname, '..', '..', 'sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// In-memory cache for fast access (loaded from disk on startup)
const sessions = new Map();

/**
 * Save a session to disk
 */
function saveToDisk(session) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session));
    return true;
  } catch (err) {
    console.error(`Session store - Failed to save ${session.id}:`, err.message);
    return false;
  }
}

/**
 * Load a session from disk
 */
function loadFromDisk(sessionId) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Session store - Failed to load ${sessionId}:`, err.message);
    return null;
  }
}

/**
 * Remove a session file from disk
 */
function deleteFromDisk(sessionId) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`Session store - Failed to delete ${sessionId}:`, err.message);
  }
}

/**
 * Load all non-expired sessions from disk on startup
 */
function loadAllSessionsFromDisk() {
  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    let loaded = 0;
    let expired = 0;

    for (const file of files) {
      const sessionId = file.replace('.json', '');
      const session = loadFromDisk(sessionId);
      if (!session) continue;

      // Check TTL
      if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        deleteFromDisk(sessionId);
        expired++;
        continue;
      }

      sessions.set(sessionId, session);
      loaded++;
    }

    console.log(`Session store - Loaded ${loaded} sessions from disk (${expired} expired)`);
  } catch (err) {
    console.error('Session store - Failed to load sessions from disk:', err.message);
  }
}

// Load sessions on module init
loadAllSessionsFromDisk();

/**
 * Create a new session from processed photo results and layout data
 */
function createSession(photoResults, layout, pageContent, theme, pageType) {
  const sessionId = crypto.randomUUID();

  // Read processed photos into base64 so they survive file cleanup
  const photos = photoResults.map((photo, index) => {
    let base64;
    try {
      // Photos in the session might already have base64 (from a previous session)
      if (photo.base64) {
        base64 = photo.base64;
      } else if (photo.processedPath) {
        const imgData = fs.readFileSync(photo.processedPath);
        base64 = imgData.toString('base64');
      } else {
        base64 = null;
      }
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
    updatedAt: Date.now(),
    photos,
    layout,
    pageContent,
    theme,
    pageType,
  };

  // Clean up expired sessions before adding new one
  cleanupExpired();

  sessions.set(sessionId, session);
  saveToDisk(session);
  console.log(`Session created: ${sessionId} (${photos.length} photos, expires in ${SESSION_TTL_DAYS} days)`);

  return sessionId;
}

/**
 * Get a session by ID, returns null if expired or not found
 * Falls back to disk if not in memory (useful after server restart)
 */
function getSession(sessionId) {
  let session = sessions.get(sessionId);

  // If not in memory, try loading from disk
  if (!session) {
    session = loadFromDisk(sessionId);
    if (session) {
      sessions.set(sessionId, session);
    }
  }

  if (!session) return null;

  // Check TTL
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    deleteFromDisk(sessionId);
    console.log(`Session expired: ${sessionId}`);
    return null;
  }

  return session;
}

/**
 * Update the layout in an existing session (persists to disk)
 */
function updateLayout(sessionId, newLayout) {
  const session = getSession(sessionId);
  if (!session) return false;

  session.layout = newLayout;
  session.updatedAt = Date.now();
  saveToDisk(session);
  return true;
}

/**
 * Remove expired sessions from memory and disk
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
      deleteFromDisk(id);
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
 * Replace the elements array in a session's layout (persists to disk)
 */
function setLayout(sessionId, elements) {
  const session = getSession(sessionId);
  if (!session) return false;
  session.layout.elements = elements;
  session.updatedAt = Date.now();
  saveToDisk(session);
  return true;
}

/**
 * List all active sessions with metadata (for "recent projects" UI)
 */
function listSessions() {
  cleanupExpired();
  const list = [];
  for (const [id, session] of sessions) {
    list.push({
      sessionId: id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt || session.createdAt,
      expiresAt: session.createdAt + SESSION_TTL_MS,
      photoCount: session.photos.length,
      pageType: session.pageType,
      section: session.pageContent?.section || null,
      pageTitle: session.pageContent?.pageTitle || null,
    });
  }
  // Sort by most recently updated
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return list;
}

/**
 * Delete a session explicitly (for "delete project" UI)
 */
function deleteSession(sessionId) {
  sessions.delete(sessionId);
  deleteFromDisk(sessionId);
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
  listSessions,
  deleteSession,
};
