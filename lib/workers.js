/*
 * Worker-related tasks
 *
 */

// Dependencies
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');

const _data = require('./data');
const helpers = require('./helpers');

// Instantiate worker object
const workers = {};

// Lookup all checks, do some operations on the data
const gatherAllChecks = () => {
  // Get all exising checks
  _data.list('checks', (err, checks) => {
    if(err || checks.length <= 0) {
      console.error('ERROR: gatherAllChecks() :: No checks available for processing');
      return;
    }

    checks.forEach(check => {
      // Read the check data
      _data.read('checks', check, (err, storedCheckData) => {
        if(err) {
          console.error('gatherAllChecks() -> read :: error: cannot read check data:', err.message);
          return;
        }

        // Pass data to validator, let it handle the rest
        validateCheckData(storedCheckData);
      });
    });
  });
};

// Timer which executes the worker process once every minute
const loop = () => {
  setInterval(() => {
    gatherAllChecks();
  }, 1000 * 60)
};

// sanity check the check data
function validateCheckData(storedCheckData) {
  const check = typeof storedCheckData === 'object' && (storedCheckData || {});
  check.id = typeof storedCheckData.id === 'string' && storedCheckData.id.trim().length === 20 && storedCheckData.id.trim();
  check.user = typeof storedCheckData.user === 'string' && storedCheckData.user.trim().length >= 10 && storedCheckData.user.trim();
  check.protocol = typeof storedCheckData.protocol === 'string' && ['http', 'https'].includes(storedCheckData.protocol) && storedCheckData.protocol.trim();
  check.url = typeof storedCheckData.url === 'string' && storedCheckData.url.trim().length >0 && storedCheckData.url.trim();
  check.method = typeof storedCheckData.method === 'string' && ['post','get','put','delete'].includes(storedCheckData.method) && storedCheckData.method.trim();
  check.successCodes = Array.isArray(storedCheckData.successCodes) && storedCheckData.successCodes.length > 0 && storedCheckData.successCodes;
  check.timeoutSeconds = typeof storedCheckData.timeoutSeconds === 'number' && storedCheckData.timeoutSeconds >= 1 && storedCheckData.timeoutSeconds <= 5 && storedCheckData.timeoutSeconds;

  // If all checks have passed, keep going
  const validCheckValues = Object.values(check).filter(it => it);
  const checkKeys = Object.keys(check);
  if(validCheckValues.length !== checkKeys.length) {
    console.error(`ERROR: Check with id ${storedCheckData.id} is not properly formatted. It will be skipped.`, check);
    return;
  }

  // Set the keys which may not be set
  check.state = (typeof storedCheckData.state === 'string'
      && ['up', 'down'].includes(storedCheckData.state) && storedCheckData.state) || 'down';
  check.lastChecked = typeof storedCheckData.lastChecked === 'number' && storedCheckData.lastChecked > 0  && storedCheckData.lastChecked;

  return performCheck(check);
}

// Perform the check and proceed with the process
function performCheck(check) {
  // Prepare the initial check outcome
  const outcome = { error:false, responseCode:false };

  // Mark that outcome hasn't been sent
  let outcomeSent = false;

  // Parse the hostname and path
  const parsedUrl = url.parse(`${check.protocol}://${check.url}`, true);
  const { hostname, path } = parsedUrl; // using path insead of "pathname" gives the full query string

  // Construct the request
  const requestOptions = {
    hostname,
    path,
    protocol: `${check.protocol}:`,
    method: check.method.toUpperCase(),
    timeout: check.timeoutSeconds * 1000,
  };

  // Instantiate the request object using http or https
  const _requestModule = check.protocol === 'http' ? http : https;
  const req = _requestModule.request(requestOptions, res => {
    // Update check outcome
    outcome.responseCode = res.statusCode;
    if(!outcomeSent) {
      processCheckOutcome(check, outcome);
      outcomeSent = true;
    }
  });

  // Bind to the error event
  req.on('error', err => {
    // Update check outcome
    outcome.error = { error:true, val:err };
    if(!outcomeSent) {
      processCheckOutcome(check, outcome);
      outcomeSent = true;
    }
  });

  // Bind to the timeout event
  req.on('timeout', err => {
    // Update check outcome
    outcome.error = { error:true, val:'timeout' };
    if(!outcomeSent) {
      processCheckOutcome(check, outcome);
      outcomeSent = true;
    }
  });

  // End/send the request
  req.end();
}

// Process the check outcome and update data as required
// Accomodate a check which has never been tested before
function processCheckOutcome(check, checkOutcome) {
  // Decide if the check is up/down
  let state = check.state;
  if(!checkOutcome.error && checkOutcome.responseCode) {
    if(check.successCodes.includes(checkOutcome.responseCode)) {
      state = 'up';
    } else {
      state = 'down';
    }
  }

  // Decide if an alert should be sent
  const shouldAlert = check.lastChecked && check.state !== state 

  // Update the check data
  const updatedCheck = {...check, state, lastChecked:Date.now() };

  // Save
  _data.update('checks', check.id, updatedCheck, err => {
    if(err) {
      console.error(`ERROR: could not save update check data for ${check.id}:`, updatedCheck);
      return;
    }

    if(!shouldAlert) {
      console.info(`INFO: no alert required for ${check.id} - state: ${state}`);
      return;
    }

    alertStateChangeFor(updatedCheck);
  });
}

function alertStateChangeFor(check, previousState) {
  const url = `${check.protocol}://${check.url}`;
  const method = check.method.toUpperCase();
  const message = `Alert: Your check ${method} ${url} is in a new state [${check.state}]`;

  helpers.sendTwilioSms(check.user, message, err => {
    if(err) {
      console.error(`ERROR: Failed to send state change to user ${check.user}`, message);
    } else {
      console.info(`INFO: state change message sent to ${check.user} successfully`, message);
    }
  });
}

// Init function/script
workers.init = () => {
  // Execute all the checks immediately
  gatherAllChecks();

  // Call the loop so the checks will run later on
  loop();
};

module.exports = workers;
