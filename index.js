/*
 * Primary file for the API
 *
 */

// Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');
const handlers = require('./lib/handlers');

// Handle server logic for both http and https
const severWrapper = (req, res) => {

  // Get the URL nd parse it
  const parsedUrl = url.parse(req.url, true);

  // Get the path
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, '');

  // Get the query sstring as an object
  const queryStringObject = parsedUrl.query;

  // Get the HTTP method
  const method = req.method.toUpperCase();

  // Get the headers as an object
  const headers = req.headers;

  // Get the payload, if any
  const decoder = new StringDecoder('utf-8');
  let buffer = '';
  req.on('data', data => {
    buffer += decoder.write(data);
  });
  req.on('end', () => {
    buffer += decoder.end();

    // Choose the handler this request shoulld go to. If none is found use notFound handler
    const requestHandler = typeof router[trimmedPath] !== 'undefined' ? router[trimmedPath] : handlers.notFound;

    // Construct the data object to send to the handler
    const data = {
      path: trimmedPath,
      query: queryStringObject,
      payload: buffer,
      method,
      headers,
    };

    // Route the request to the handler specified in the router
    requestHandler(data, (statusCode, payload) => {
      // Use the status sent back by the handler or default to 200
      statusCode = typeof statusCode === 'number' ? statusCode : 200;

      // Use the payload called back by the handler or default to any empty object
      payload = typeof payload === 'object' ? payload : {};

      // convert the payload into a string
      const payloadString = JSON.stringify(payload);

      // Return response
      res.setHeader('Content-type', 'application/json');
      res.writeHead(statusCode)
      res.end(payloadString);

      // Log the request path
      console.log(headers, '\n', method, `/${trimmedPath}`);
      console.log('Responding with status:', statusCode);
      console.log('payload:', payload);
    });
  });
};

// Insantiate http server
const httpServer = http.createServer(severWrapper);

// Start the http server
httpServer.listen(config.httpPort, () => console.log(`Server up on port http://localhost:${config.httpPort}`));

// Insantiate http server
const httpsServerOpts = {
  key: fs.readFileSync('./https/key.pem'),
  cert: fs.readFileSync('./https/cert.pem'),
};
const httpsServer = http.createServer(httpsServerOpts, severWrapper);

// Start the http server
httpsServer.listen(config.httpsPort, () => console.log(`Server up on port https://localhost:${config.httpsPort}`));

// Defining a request Router
const router = {
  'health': handlers.health,
  'users': handlers.users,
};
