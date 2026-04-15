'use strict';

/**
 * Simple logger singleton.
 * Wraps console with structured output: [TIMESTAMP] [LEVEL] message ...args
 *
 * - All levels always log (info, warn, error)
 * - debug only logs when NODE_ENV === 'development'
 *
 * Usage:
 *   const logger = require('./logger');
 *   logger.info('Server started on port', 3000);
 *   logger.error('Something went wrong', err);
 *   logger.debug('Detailed info', { payload });  // only in development
 */

function timestamp() {
  return new Date().toISOString();
}

const isDevelopment = () => process.env.NODE_ENV === 'development';

const logger = {
  info(...args) {
    console.log(`[${timestamp()}] [INFO]`, ...args);
  },

  warn(...args) {
    console.warn(`[${timestamp()}] [WARN]`, ...args);
  },

  error(...args) {
    console.error(`[${timestamp()}] [ERROR]`, ...args);
  },

  debug(...args) {
    if (isDevelopment()) {
      console.log(`[${timestamp()}] [DEBUG]`, ...args);
    }
  },
};

module.exports = logger;
