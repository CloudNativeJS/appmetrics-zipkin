'use strict';

module.exports.request = ({ http, hostname, port }) => {
  return new Promise(resolve => {
    http.get({ hostname: 'localhost', port }, (res) => {
      resolve({ request: res.req, response: res });
    });
  });
};

module.exports.createServer = ({ http, port }) => {
  return new Promise((resolve) => {
    let server = http.createServer(function(req, res) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello World\n');
    });
    server.listen(port, function() {
      resolve(server);
    });
  });
};
