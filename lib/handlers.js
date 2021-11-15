/*
 * Request handlers/controller
 *
 */

// Dependencies

// Define the handlers
const handlers = {};

module.exports = handlers;

// sample handler
handlers.health = (data, callback) => {
  callback(200, { name: 'uptime monitor' });
};

// users
handlers.users = (data, callback) => {
  const EXPECTED_METHODS = ['post', 'get', 'put', 'delete'];
  if(!EXPECTED_METHODS.includes(data.method.toLowerString())) {
    return callback(405);
  }
  return handlers._users[data.method](data, callback);
};

// Container for the users submethods
handlers._users = {};

// Users methods
// 
handlers._users.post = (data, callback) => {

};

handlers._users.get = (data, callback) => {

};

handlers._users.put = (data, callback) => {

};


handlers._users.delete = (data, callback) => {

};

// Not found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

