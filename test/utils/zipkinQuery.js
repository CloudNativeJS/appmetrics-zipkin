'use strict';

const request = require('request-promise-native');

const url = ({ zipkinHost, zipkinPort }) => `http://${zipkinHost}:${zipkinPort}`;

module.exports.getTraces = ({ zipkinHost, zipkinPort, serviceName }) => {
  const zipkinUrl = url({ zipkinHost, zipkinPort });
  return request({
    url: `${zipkinUrl}/api/v2/traces`,
    qs: {
      serviceName
    },
    json: true
  });
};

