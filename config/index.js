/*
 * Export configs for runtime
 */

module.exports = getConfig(process.env.NODE_ENV);

// Determine environment from NODE_ENV variable
function getConfig(env) {
  let config;
  switch(env?.toLowerCase()) {
    case 'prod':
      config = require('./production.env');
      return config;
    case 'dev':
    default:
      config = require('./developmet.env');
      return config;
  }
}
