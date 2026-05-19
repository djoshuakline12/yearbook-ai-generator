/**
 * Basic Error Logger
 *
 * Logs errors and important events to:
 * 1. Console (visible in Railway logs)
 * 2. logs/errors.log file (for review later)
 *
 * Captures: timestamp, severity, message, error details, request context
 *
 * For production monitoring at scale, integrate Sentry or LogRocket.
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');
const ERROR_LOG_PATH = path.join(LOGS_DIR, 'errors.log');
const INFO_LOG_PATH = path.join(LOGS_DIR, 'info.log');
const MAX_LOG_SIZE_MB = 50;

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Rotate log file if it gets too big
 */
function rotateIfNeeded(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > MAX_LOG_SIZE_MB) {
      const oldPath = filePath + '.old';
      // Delete previous old log if exists
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      fs.renameSync(filePath, oldPath);
    }
  } catch (err) {
    console.error('Log rotation failed:', err.message);
  }
}

/**
 * Format a log entry
 */
function formatEntry(level, message, error, context) {
  const timestamp = new Date().toISOString();
  let entry = `[${timestamp}] [${level}] ${message}`;

  if (error) {
    entry += `\n  Error: ${error.message || error}`;
    if (error.stack) {
      entry += `\n  Stack: ${error.stack.split('\n').slice(0, 5).join('\n         ')}`;
    }
  }

  if (context && Object.keys(context).length > 0) {
    entry += `\n  Context: ${JSON.stringify(context)}`;
  }

  return entry + '\n';
}

/**
 * Log an error to console and file
 */
function logError(message, error, context = {}) {
  const entry = formatEntry('ERROR', message, error, context);
  console.error(entry.trim());

  try {
    rotateIfNeeded(ERROR_LOG_PATH);
    fs.appendFileSync(ERROR_LOG_PATH, entry);
  } catch (err) {
    console.error('Failed to write error log:', err.message);
  }
}

/**
 * Log a warning
 */
function logWarning(message, context = {}) {
  const entry = formatEntry('WARN', message, null, context);
  console.warn(entry.trim());

  try {
    rotateIfNeeded(ERROR_LOG_PATH);
    fs.appendFileSync(ERROR_LOG_PATH, entry);
  } catch (err) {
    console.error('Failed to write log:', err.message);
  }
}

/**
 * Log informational events (queue activity, generation completion, etc.)
 * Only writes to file if VERBOSE_LOGGING env var is set, always logs to console.
 */
function logInfo(message, context = {}) {
  console.log(`[INFO] ${message}`);

  if (process.env.VERBOSE_LOGGING === 'true') {
    try {
      const entry = formatEntry('INFO', message, null, context);
      rotateIfNeeded(INFO_LOG_PATH);
      fs.appendFileSync(INFO_LOG_PATH, entry);
    } catch (err) {
      console.error('Failed to write info log:', err.message);
    }
  }
}

/**
 * Express middleware to log all errors and unhandled exceptions
 */
function errorMiddleware(err, req, res, next) {
  logError(`Request failed: ${req.method} ${req.path}`, err, {
    method: req.method,
    path: req.path,
    query: req.query,
    sessionId: req.params?.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
}

/**
 * Read recent error log entries (for debugging)
 */
function getRecentErrors(limit = 50) {
  try {
    if (!fs.existsSync(ERROR_LOG_PATH)) return [];
    const data = fs.readFileSync(ERROR_LOG_PATH, 'utf8');
    const entries = data.split(/\n(?=\[\d{4})/).filter(Boolean);
    return entries.slice(-limit);
  } catch (err) {
    console.error('Failed to read error log:', err.message);
    return [];
  }
}

// Catch uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (err) => {
  logError('Uncaught Exception', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)));
});

module.exports = {
  logError,
  logWarning,
  logInfo,
  errorMiddleware,
  getRecentErrors,
};
