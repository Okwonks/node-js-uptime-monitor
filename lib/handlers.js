/*
 * Request handlers/controller
 *
 */

// Dependencies
const _data = require('./data');
const config = require('./config');
const helpers = require('./helpers');

// Define the handlers
const handlers = {};

module.exports = handlers;

// sample handler
handlers.health = (data, callback) => {
  callback(200, { name: 'Uptime Monitor' });
};

// users
handlers.users = (data, callback) => {
  const EXPECTED_METHODS = ['post', 'get', 'put', 'delete'];
  const method = data.method.toLowerCase();
  if(!EXPECTED_METHODS.includes(method)) {
    return callback(405);
  }
  return handlers._users[method](data, callback);
};

// Container for the users submethods
handlers._users = {};

// Users methods
// POST
// Required data: firstName, lastName, phone, password, tosAgreement
handlers._users.post = (data, callback) => {
  // Check that all required fields are filled out
  const payload = data.payload;
  const firstName = typeof payload.firstName === 'string'
      && payload.firstName.trim().length > 0 && payload.firstName;
  const lastName = typeof payload.lastName === 'string'
      && payload.lastName.trim().length > 0 && payload.lastName;
  const phone = typeof payload.phone === 'string'
      && payload.phone.trim().length > 10 && payload.phone;
  const password = typeof payload.password === 'string'
      && payload.password.trim().length > 0 && payload.password;
  const tosAgreement = typeof payload.tosAgreement === 'boolean' && payload.tosAgreement === true;

  if(!firstName && !lastName && !phone && !password && !tosAgreement) { 
    return callback(400, { error:'Missing requried fields' });
  }

  // Make sure a user doesn't exist
  _data.read('users', phone, (err, data) => {
    if(!err) {
      // User already exists - fs found a file
      return callback(400, { error:'a user with that phone number already exists' });
    }

    // Hash the password
    const hashedPassowrd = helpers.hash(password);
    if(!hashedPassowrd) {
      return callback(500, { error:'Internal server error. Password could not be hashed' });
    }

    // Create the user object
    const user = { firstName, lastName, phone, password: hashedPassowrd, tosAgreement:true };

    // Store the user
    _data.create('users', phone, user, err => {
      if(!err) {
        return callback(200);
      }

      console.error('Could not create the user:', err);
      return callback(500, { error:'Internal server error. User not created' });
    });
  });
};

// GET
// Required data: phone
// Optional data: none
handlers._users.get = (data, callback) => {
  // Check that phone is valid
  const { query, headers } = data;
  const phone = typeof query.phone === 'string' && query.phone.trim() >= 10 && query.phone;
  if(!phone) {
    return callback(400, { error:'Missing required field' });
  }

  // Get the token from the headers
  const token = typeof headers.token === 'string' && headers.token;

  // Verify that the given token is valid for the phone number
  handlers._tokens.verifyToken(token, phone, isValid => {
    if(!isValid) {
      return callback(403, { error:'Missing or invalid token supplied' });
    }

    _data.read('users', phone, (err, user) => {
      if(err) {
        callback(404);
      }

      // Remove password from object returned
      delete user.password;
      callback(200, user);
    });
  });
};

// PUT
// Required data: phone
// Optional data: firstName, lastName, password (at least one)
handlers._users.put = (data, callback) => {
  // Check that phone is valid
  const { payload, headers } = data;
  const phone = typeof payload.phone === 'string' && payload.phone.trim() >= 10 && payload.phone;
  if(!phone) {
    return callback(400, { error:'Missing required field' });
  }

  // Get the token from the headers
  const token = typeof headers.token === 'string' && headers.token;

  // Verify that the given token is valid for the phone number
  handlers._tokens.verifyToken(id, phone, isValid => {
    if(!isValid) {
      return callback(403, { error:'Missing or invalid token supplied' });
    }

    // Check for optional fields
    const firstName = typeof payload.firstName === 'string'
        && payload.firstName.trim().length > 0 && payload.firstName;
    const lastName = typeof payload.lastName === 'string'
        && payload.lastName.trim().length > 0 && payload.lastName;
    const password = typeof payload.password === 'string'
        && payload.password.trim().length > 0 && payload.password;

    if(!firstName && !lastName && !password) {
      return callback(400, { error:'Missing fields to update' });
    }

    _data.read('users', phone, (err, user) => {
      if(err) {
        return callback(404, { error:'User not found' });
      }

      const update = {
        firstName: firstName || user.firstName,
        lastName:  lastName || user.lastName,
        password:  helpers.hash(password) || user.password,
      };

      // Store the update
      _data.update('users', phone, update, err => {
        if(err) {
          console.error(err);
          return callback(500, { error:'Internal server error - unable to write updates' });
        }

        callback(200);
      });
    });
  });
};

// DELETE
// Required data: phone
handlers._users.delete = (data, callback) => {
  // Check that phone is valid
  const { query } = data;
  const phone = typeof query.phone === 'string' && query.phone.trim().length >= 10 && query.phone;
  if(!phone) {
    return callback(400, { error:'Missing required field' });
  }

  // Get the token from the headers
  const token = typeof headers.token === 'string' && headers.token;

  // Verify that the given token is valid for the phone number
  handlers._tokens.verifyToken(token, phone, isValid => {
    if(!isValid) {
      return callback(403, { error:'Missing or invalid token supplied' });
    }

    _data.read('users', phone, (err, user) => {
      if(err) {
        return callback(404, { error:'User does not exist' });
      }

      _data.delete('users', phone, err => {
        if(err) {
          return callback(500, { error:'Internal server error - unable to delete user' });
        }

        // Delete all checks associated with the user
        const userChecks = (user?.checks?.length && Array.isArray(user.checks) && user.checks) ?? [];
        if(userChecks.length) {
          const  errors = [];
          let checksDeleted = 0;
          let deletionErrors = false;

          userChecks.forEach(id => {
            _data.delete('checks', id, err => {
              if(err) {
                deletionErrors = true;
                errors.push({ id:err.message });
              }

              checksDeleted++;
              if(checksDeleted === userChecks.length && deletionErrors) {
                console.error('Not all errors were deleted successfully');
                console.error('Errors:', errors);
                return callback(500, { error:'Errors encounted while deleting user checks.' });
              }
            });
          });
        }

        callback(200);
      });
    });
  });
};

// Tokens
handlers.tokens = (data, callback) => {
  const EXPECTED_METHODS = ['post', 'get', 'put', 'delete'];
  const method = data.method.toLowerCase();
  if(!EXPECTED_METHODS.includes(method)) {
    return callback(405);
  }
  return handlers._tokens[method](data, callback);
};

// Container for the tokens submethods
handlers._tokens = {};

// POST
// Required data: phone, password
handlers._tokens.post = (data, callback) => {
  const { payload } = data;

  const phone = typeof payload.phone === 'string'
      && payload.phone.trim().length > 10 && payload.phone;
  const password = typeof payload.password === 'string'
      && payload.password.trim().length > 0 && payload.password;
  if(!phone && !password) {
    return callback(400, { error:'Missing required field(s)' });
  }

  // Lookup pthe user who matches the phone number
  _data.read('users', phone, (err, userData) => {
    if(err) {
      return callback(400, { error:'Could not find the specified user' });
    }

    const hashedPassowrd = helpers.hash(password);
    if(hashedPassowrd !== userData.password) {
      return callback(400, { error:'Password did not match the specified user\'s stored password' });
    }

    // If valid, create a new token with a random name. Set expiration date 1 hour in the future
    const id = helpers.createRandomString(20);
    const expires = Date.now() + 1000 * 60 * 60;
    const token = { phone, id, expires };

    // Store the token
    _data.create('tokens', id, token, err => {
      if(err) {
        return callback(500, { error:'Could not create the new token' });
      }
      callback(200, token);
    });
  });

};

// GET
// Required data: id
// Optional data: none
handlers._tokens.get = (data, callback) => {
  const { query } = data;

  const id = typeof query.id === 'string' && query.id.trim().length === 20 && query.id.trim();
  if(!id) {
    return callback(400, { error:'Missing required field' });
  }

  _data.read('tokens', id, (err, token) => {
    if(err) {
      return callback(404);
    }

    callback(200, token);
  });
};

// PUT
// Required data: id, extend
// Optional data: none
handlers._tokens.put = (data, callback) => {
  const { payload } = data;

  const id = typeof payload.id === 'string' && payload.id.trim().length === 20 && payload.id.trim();
  const extend = typeof payload.extend === 'boolean' && payload.extend === true;
  if(!id && !extend) {
    return callback(400, { error:'Missing required field(s) or field(s) are invalid' });
  }

  _data.read('tokens', id, (err, token) => {
    if(err) {
      return callback(400, { error:'Specified token does not exist' });
    }

    // Make sure the token isn't alread expire
    if(token.expires < Date.now()) {
      return callback(400, { error:'The token has already expired and cannot be extended' });
    }

    const updatedToken = { ...token, expires:Date.now() + 1000 * 60 * 60 };

    // Store the new updates
    _data.update('tokens', id, updatedToken, err => {
      if(err) {
        return callback(500, { error:'Could not update the token\'s expiration' });
      }

      callback(200);
    });
  });
};

// DELETE
// Required data: id
// Optional data: none
handlers._tokens.delete = (data, callback) => {
  // Check that id is valid
  const { query } = data;

  const id = typeof query.id === 'string' && query.id.trim().length === 20 && query.id;
  if(!id) {
    return callback(400, { error:'Missing required field' });
  }

  _data.read('tokens', id, (err, token) => {
    if(err) {
      return callback(404, { error:'token does not exist' });
    }

    _data.delete('tokens', id, err => {
      if(err) {
        return callback(500, { error:'Internal server error - unable to delete token' });
      }

      callback(200);
    });
  });
};

handlers.checks = (data, callback) => {
  const EXPECTED_METHODS = ['post', 'get', 'put', 'delete'];
  const method = data.method.toLowerCase();
  if(!EXPECTED_METHODS.includes(method)) {
    return callback(405);
  }
  return handlers._checks[method](data, callback);
};

handlers._checks = {};

// POST
// Required data: protocol, url, method, successCodes, timeoutSeconds
// Optional data: none
handlers._checks.post = (data, callback) => {
  const { payload, headers } = data;
  const EXPECTED_PROTOCOLS = [ 'http', 'https' ];
  const EXPECTED_METHODS = ['post', 'get', 'put', 'delete'];

  const protocol = typeof payload.protocol === 'string'
      && EXPECTED_PROTOCOLS.includes(payload.protocol) && payload.protocol;
  const url = typeof payload.url === 'string'
      && payload.url.trim().length > 0 && payload.url;
  const method = typeof payload.method === 'string'
      && EXPECTED_METHODS.includes(payload.method) && payload.method;
  const successCodes = typeof payload.successCodes === 'object'
      && Array.isArray(payload.successCodes) && payload.successCodes.length > 0 && payload.successCodes;
  const timeoutSeconds = typeof payload.timeoutSeconds === 'number'
      && payload.timeoutSeconds > 0 && payload.timeoutSeconds <= 5 && payload.timeoutSeconds;

  if(!protocol || !url || !method || !successCodes || !timeoutSeconds) {
    return callback(400, { error:'Missing required field(s)' });
  }

  // Get the token from the headers
  const token = typeof headers.token === 'string' && headers.token;

  // Look up user by reading the token
  _data.read('tokens', token, (err, tokenData) => {
    if(err) {
      return callback(403);
    }

    // Get the users phone number
    const { phone } = tokenData;

    // Lookup the user data
    _data.read('users', phone, (err, user) => {
      if(err) {
        return callback(403);
      }

      const userChecks = (user?.checks?.length && user.checks) || [];

      // Verify that the user has less checks than the max number of checks
      if(userChecks.length >= config.maxChecks) {
        return callback(400, { error:`The user already has the maximun number of checks (${config.maxChecks})` });
      }

      // Create a random id for the check
      const checkId = helpers.createRandomString(20);

      // Create the check object and include the user's phone number
      const checkData = {
        id: checkId,
        user: phone,
        method,
        protocol,
        successCodes,
        timeoutSeconds,
        url,
      };

      // Persist object to disc
      _data.create('checks', checkId, checkData, err => {
        if(err) {
          return callback(500, { error:'Could not create new check' });
        }

        const userUpdate = { ...user, checks:[ ...userChecks, checkData ]};

        // Save the updated user data
        _data.update('users', phone, userUpdate, err => {
          if(err) {
            return callback(500, { error:'Could not update the user with the new check' });
          }

          callback(200, checkData);
        });
      });
    });
  });
};

// Get
// Required data: id
// Optional data: none
handlers._checks.get = (data, callback) => {
  // Check that id is valid
  const { query, headers } = data;
  const id = typeof query.id === 'string' && query.id.trim() === 20 && query.id;
  if(!id) {
    return callback(400, { error:'Missing required field' });
  }

  // Lookup the check
  _data.read('checks', id, (err, check) => {
    if(err) {
      return callback(404);
    }

    // Get the token from the headers
    const token = typeof headers.token === 'string' && headers.token;

    // Verify that the given token is valid and belongs to the correct user
    handlers._tokens.verifyToken(token, check.user, isValid => {
      if(!isValid) {
        return callback(403, { error:'Missing or invalid token supplied' });
      }

      // If token is valid send back check
      callback(200, check);
    });
  });
};

// PUT
// Required data: id
// Optional data: protocol, url, method, successCodes, timeoutSeconds (one must be sent)
handlers._checks.put = (data, callback) => {
  // Check that id is valid
  const { payload, headers } = data;
  const id = typeof payload.id === 'string' && payload.id.trim().length === 20 && payload.id;
  if(!id) {
    return callback(400, { error:'Missing required field' });
  }

  // Check for the optional fields
  const protocol = typeof payload.protocol === 'string'
      && EXPECTED_PROTOCOLS.includes(payload.protocol) && payload.protocol;
  const url = typeof payload.url === 'string'
      && payload.url.trim().length > 0 && payload.url;
  const method = typeof payload.method === 'string'
      && EXPECTED_METHODS.includes(payload.method) && payload.method;
  const successCodes = typeof payload.successCodes === 'object'
      && Array.isArray(payload.successCodes) && payload.successCodes.length > 0 && payload.successCodes;
  const timeoutSeconds = typeof payload.timeoutSeconds === 'number'
      && payload.timeoutSeconds > 0 && payload.timeoutSeconds <= 5 && payload.timeoutSeconds;

  if(!protocol && !url && !method && !successCodes && !timeoutSeconds) {
    return callback(400, { error:'Missing fields to update' });
  }

  _data.read('checks', id, (err, check) => {
    if(err) {
      return callback(404, { error:'Check id does not exist' });
    }

    // Get the token from the headers
    const token = typeof headers.token === 'string' && headers.token;

    // Verify that the given token is valid for the id number
    handlers._tokens.verifyToken(token, check.user, isValid => {
      if(!isValid) {
        return callback(403);
      }

      const updatedCheck = {
        ...check,
        url: url || check.url,
        method: method || check.method,
        protocol: protocol || check.protocol,
        successCodes: successCodes || check.successCodes,
        timeoutSeconds: timeoutSeconds || check.timeoutSeconds,
      };

      _data.update('checks', id, updatedCheck, (err) => {
        if(err) {
          return callback(500, { error:'Could not update the check' });
        }

        callback(200);
      });
    });
  });
};

// DELETE
// Required data: id
// Optional data: none
handlers._checks.delete = (data, callback) => {
  // Check that id is valid
  const { query, headers } = data;
  const id = typeof query.id === 'string' && query.id.trim().length === 20 && query.id;
  if(!id) {
    return callback(400, { error:'Missing required field' });
  }

  // Lookup the check
  _data.read('checks', id, (err, check) => {
    if(err) {
      return callback(400, { error:'Specified check id does not exist' });
    }

    // Get the token from the headers
    const token = typeof headers.token === 'string' && headers.token;

    // Verify that the given token is valid for the phone number
    handlers._tokens.verifyToken(token, check.user, isValid => {
      if(!isValid) {
        return callback(403, { error:'Missing or invalid token supplied' });
      }

      // Delete the check data
      _data.delete('checks', id, err => {
        if(err) {
          console.error(err.message);
          return callback(500, { error:'Could not delete the check' });
        }

        _data.read('users', check.user, (err, user) => {
          if(err) {
            console.error(err.message);
            return callback(500, { error:'Could not find the user who created the check' });
          }

          const userChecks = (user?.checks?.length && user.checks) ?? [];
          if(userChecks.indexOf(id) > -1) {
            return callback(500, { error:'Could not find check on user' });
          }

          const userUpdate = { ...user, checks:userChecks.filter(c => c !== id) };

          _data.update('users', user.phone, userUpdate, err => {
            if(err) {
              return callback(500, { error:'Unable to update user' });
            }

            callback(200);
          });
        });
      });
    });
  });
};

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = (id, phone, callback) => {
  // Lookup the token
  _data.read('tokens', id, (err, token) => {
    if(err) {
      console.error(err)
      return callback(false);
    }

    if(token.phone !== phone || Date.now() > token.expires) {
      return callback(false);
    }

    callback(true);
  });
};

// Not found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

