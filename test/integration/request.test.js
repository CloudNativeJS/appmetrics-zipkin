'use strict';

const { expect } = require('chai');

const { request, createServer } = require('../utils/http');
const { getTraces } = require('../utils/zipkinQuery');

const zipkinHost = '127.0.0.1';
const zipkinPort = 9411;
const zipkinSampleRate = 1.0;
const serviceName = 'frontend';

function waitAndGetTraces() {
  return new Promise(resolve => {
    setTimeout(() => { // We want to let all background requests going to zipkin complete
      resolve(getTraces({ zipkinHost, zipkinPort, serviceName }));
    }, 1000);
  });
}

describe('http requests', () => {
  describe('outbound requests', () => {
    let server;
    let http;

    before(() => {
      require('../../')({
        host: zipkinHost,
        port: zipkinPort,
        sampleRate: zipkinSampleRate,
        serviceName
      });

      http = require('http');
      return createServer({ http, port: 3000 })
        .then(createdServer => {
          server = createdServer;
        });
    });
    after(() => {
      if (server) server.close();
    });
    it('should reach zipkin with a simple http request (string options)', () => {
      let outgoingTraceId;
      return request({ http, options: 'http://localhost:3000' })
        .then(({ request }) => {
          const outgoingHeaders = request._headers;
          outgoingTraceId = outgoingHeaders['x-b3-traceid'];
        })
        .then(waitAndGetTraces)
        .then((traces) => {
          expect(traces.length > 0).to.be.ok;
          expect(traces.some(trace => trace[0].traceId === outgoingTraceId)).to.be.ok;
        });
    });
    it('should reach zipkin with a simple http request (object options)', () => {
      let outgoingTraceId;
      return request({ http, options: { hostname: 'localhost', port: 3000 } })
        .then(({ request }) => {
          const outgoingHeaders = request._headers;
          outgoingTraceId = outgoingHeaders['x-b3-traceid'];
        })
        .then(waitAndGetTraces)
        .then((traces) => {
          expect(traces.length > 0).to.be.ok;
          expect(traces.some(trace => trace[0].traceId === outgoingTraceId)).to.be.ok;
        });
    });
  });
});
