module.exports = {
  httpPort: parseInt(process.env.PORT, 10) || 8080,
  httpsPort: 8081,
  hashingSecret: 'SECRET',
  maxChecks: 5,
};
