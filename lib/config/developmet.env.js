module.exports = {
  httpPort: parseInt(process.env.PORT, 10) || 8080,
  httpsPort: 8081,
  envName: 'dev',
  hashingSecret: 'SECRET',
  maxChecks: 5,
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },
};
