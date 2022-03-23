/*
 * Primary file for the API
 *
 */

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');

// Declare the app??
const app = {};

// App initialisation function
app.init = () => {
  // Start server
  server.init();

  // Start workers
  workers.init();
};

app.init();

module.exports = app;
