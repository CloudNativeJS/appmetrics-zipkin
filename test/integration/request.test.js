'use strict';

const { expect } = require('chai');

const { request, createServer } = require('../utils/http');
const { getTraces } = require('../utils/zipkinQuery');

const zipkinHost = '127.0.0.1';
const zipkinPort = 9411;
const zipkinSampleRate = 1.0;
const serviceName = 'frontend';

async function waitAndGetTraces() {
  return new Promise(resolve => {
    setTimeout(async () => { // We want to let all background requests going to zipkin complete
      const traces = await getTraces({ zipkinHost, zipkinPort, serviceName });
      resolve(traces);
    });
  });
}

describe('http requests', () => {
  describe('outbound requests', () => {
    let server;
    let http;

    before(async () => {
      require('../../')({
        host: zipkinHost,
        port: zipkinPort,
        sampleRate: zipkinSampleRate,
        serviceName
      });

      http = require('http');
      server = await createServer({ http, port: 3000 });
    });
    after(() => {
      if (server) server.close();
    });
    it('should reach zipkin', async () => {
      await request({ http, hostname: 'localhost', port: 3000 });
      const traces = await waitAndGetTraces();
      expect(traces.length > 0).to.be.ok;
    });
  });
});
