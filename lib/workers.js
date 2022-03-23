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
    if(err || checks.length <== 0) {
      console.error('gatherAllChecks() :: error: No checks available for processing');
      return;
    }

    checks.forEach(check => {
      // Read the check dataa
      _data.read('check', check, (err, storedCheckData) => {
        if(err) {
          console.error('gatherAllChecks() -> read :: error: cannot read check dat');
          return;
        }

        // Pass data to validator, let it handle the rest

      });
  });
};

// Timer which executes the worker process once every minute
const loop = () => {
  setInterval(() => {
    gatherAllChecks();
  }, 1000 * 60)
};

// Init function
workers.init = () => {
  // Execute all the checks immediately

  // Call the loop so the checks will run later on

};

module.exports = workers;
