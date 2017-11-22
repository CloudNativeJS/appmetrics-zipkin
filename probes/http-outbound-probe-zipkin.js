/*******************************************************************************
 * Copyright 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *******************************************************************************/
'use strict';
var Probe = require('../lib/probe.js');
var aspect = require('../lib/aspect.js');
var util = require('util');
var url = require('url');
var semver = require('semver');
const zipkin = require('zipkin');

var serviceName;

const {
  Request,
  Annotation
} = require('zipkin');

const CLSContext = require('zipkin-context-cls');
const ctxImpl = new CLSContext();

var methods;
// In Node.js < v8.0.0 'get' calls 'request' so we only instrument 'request'
if (semver.lt(process.version, '8.0.0')) {
  methods = ['request'];
} else {
  methods = ['request', 'get'];
}

// Probe to instrument outbound http requests

function HttpOutboundProbeZipkin() {
  Probe.call(this, 'http'); // match the name of the module we're instrumenting
}
util.inherits(HttpOutboundProbeZipkin, Probe);

HttpOutboundProbeZipkin.prototype.attach = function(name, target) {
  const tracer = new zipkin.Tracer({
    ctxImpl,
    recorder: this.recorder,
    sampler: new zipkin.sampler.CountingSampler(0.01), // sample rate 0.01 will sample 1 % of all incoming requests
    traceId128Bit: true // to generate 128-bit trace IDs.
  });
  serviceName = this.serviceName;
  if (name === 'http') {
    if (target.__zipkinOutboundProbeAttached__) return target;
    target.__zipkinOutboundProbeAttached__ = true;
    aspect.around(
      target,
      methods,
      // Before 'http.request' function
      function(obj, methodName, methodArgs, probeData) {
        // Get HTTP request method from options
        var options = methodArgs[0];
        var requestMethod = 'GET';
        var urlRequested = '';
        if (typeof options === 'object') {
          urlRequested = formatURL(options);
          if (options.method) {
            requestMethod = options.method;
          }
        } else if (typeof options === 'string') {
          urlRequested = options;
          var parsedOptions = url.parse(options);
          if (parsedOptions.method) {
            requestMethod = parsedOptions.method;
          }
        }
        // Must assign new options back to methodArgs[0]
        methodArgs[0] = Request.addZipkinHeaders(options, tracer.createChildId());
        tracer.recordServiceName(serviceName);
        tracer.recordRpc(requestMethod);
        tracer.recordBinary('http.url', urlRequested);
        tracer.recordAnnotation(new Annotation.ClientSend());
        // End metrics
        aspect.aroundCallback(
          methodArgs,
          probeData,
          function(target, args, probeData) {
            tracer.recordBinary('http.status_code', target.res.statusCode.toString());
            tracer.recordAnnotation(new Annotation.ClientRecv());
          },
          function(target, args, probeData, ret) {
            return ret;
          }
        );
      },
      // After 'http.request' function returns
      function(target, methodName, methodArgs, probeData, rc) {
        // If no callback has been used then end the metrics after returning from the method instead
        return rc;
      }
    );
  }
  return target;
};

// Get a URL as a string from the options object passed to http.get or http.request
// See https://nodejs.org/api/http.html#http_http_request_options_callback
function formatURL(httpOptions) {
  var url;
  if (httpOptions.protocol) {
    url = httpOptions.protocol;
  } else {
    url = 'http:';
  }
  url += '//';
  if (httpOptions.auth) {
    url += httpOptions.auth + '@';
  }
  if (httpOptions.host) {
    url += httpOptions.host;
  } else if (httpOptions.hostname) {
    url += httpOptions.hostname;
  } else {
    url += 'localhost';
  }
  if (httpOptions.port) {
    url += ':' + httpOptions.port;
  }
  if (httpOptions.path) {
    url += httpOptions.path;
  } else {
    url += '/';
  }
  return url;
}

module.exports = HttpOutboundProbeZipkin;
