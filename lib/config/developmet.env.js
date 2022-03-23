module.exports = {
  httpPort: parseInt(process.env.PORT, 10) || 8080,
  httpsPort: 8081,
  envName: 'dev',
  hashingSecret: 'SECRET',
  maxChecks: 5,
  twilio: {
    accountSid: 'AC234c9f4956473a618d1737f8ab92d255',
    authToken: '7266f52b1d0a765f7af16c9b2acec58b',
    fromNumber: '+18594848980',
  },
};
