/*
 * Helpers for various tasks
 *
 */

// Dependencies
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const config = require('./config');

// Container for helpers
const helpers = {};

module.exports = helpers;

helpers.hash = str => {
  if(str && str.length > 0) {
    return crypto.createHmac('sha256', config.hashingSecret)
      .update(str)
      .digest('hex');
  }

  return;
};

// Parse JSON string in all cases without throwing
helpers.parseJson = str => {
  if(!str) {
    // No point in trying to parse an empty string
    return {};
  }

  try {
    const parsed = JSON.parse(str);
    return parsed;
  } catch(err) {
    console.error(`helpers.parseJson() :: Failed to parse string ${str}. Sending back an empty object.`);
    return {};
  }
};

// Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = strLength => {
  strLength = typeof strLength === 'number' && strLength > 0 && strLength;
  if(!strLength) {
    return false;
  }

  const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

  // Start the final string
  let str = '';
  let randomCharacter;
  for(i = 1; i <= strLength; i++) {
    // Get a random character from the possibleCharacters string;
    randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));

    // Append this character to the final string
    str += randomCharacter;
  }

  return str;
};

// Send SMS using twilio
helpers.sendTwilioSms = (phone, msg, cb) => {
  const validPhone = typeof phone === 'string' && phone.trim().length >= 10;
  const validMsg = typeof msg === 'string' && msg.trim().length <= 1600;
  if(!validPhone || !validMsg) {
    return cb('Missing or invalid arguments supplied');
  }

  const payload = querystring.stringify({
    From: config.twilio.fromNumber,
    To: `+${phone}`,
    Body: msg.trim(),
  });

  const twilioRequest = {
    protocol: 'https:',
    hostname: 'api.twilio.com',
    method: 'POST',
    path: `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
    auth: `${config.twilio.accountSid}:${config.twilio.authToken}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = https.request(twilioRequest, res => {
    if(res.statusCode > 201) {
      return cb(`Status code returned was: ${res.statusCode}`);
    }

    cb(false);
  });

  req.on('error', e => cb(e));
  req.write(payload);
  req.end();
};
