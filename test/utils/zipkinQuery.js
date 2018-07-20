'use strict';

const request = require('request-promise-native');

const url = ({ zipkinHost, zipkinPort }) => `http://${zipkinHost}:${zipkinPort}`;

module.exports.getTraces = async ({ zipkinHost, zipkinPort, serviceName }) => {
  const zipkinUrl = url({ zipkinHost, zipkinPort });
  const result = await request({
    url: `${zipkinUrl}/api/v1/traces`,
    qs: {
      serviceName
    },
    json: true
  });
  return result;
};

