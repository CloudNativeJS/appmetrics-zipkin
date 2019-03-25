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
var tool = require('../lib/tools.js');
var util = require('util');
var url = require('url');
var semver = require('semver');
const zipkin = require('zipkin');

var serviceName;
var ibmapmContext;
var headerFilters;
var pathFilters;
var tracer;

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

function HttpsOutboundProbeZipkin() {
  Probe.call(this, 'https'); // match the name of the module we're instrumenting
}
util.inherits(HttpsOutboundProbeZipkin, Probe);


HttpsOutboundProbeZipkin.prototype.updateProbes = function() {
  serviceName = this.serviceName;
  ibmapmContext = this.ibmapmContext;
  headerFilters = this.headerFilters;
  pathFilters = this.pathFilters;
  tracer = new zipkin.Tracer({
    ctxImpl,
    recorder: this.recorder,
    sampler: new zipkin.sampler.CountingSampler(this.config.sampleRate), // sample rate 0.01 will sample 1 % of all incoming requests
    traceId128Bit: true // to generate 128-bit trace IDs.
  });
};

HttpsOutboundProbeZipkin.prototype.attach = function(name, target) {
  tracer = new zipkin.Tracer({
    ctxImpl,
    recorder: this.recorder,
    sampler: new zipkin.sampler.CountingSampler(this.config.sampleRate), // sample rate 0.01 will sample 1 % of all incoming requests
    traceId128Bit: true // to generate 128-bit trace IDs.
  });
  serviceName = this.serviceName;
  if (name === 'https') {
    if (target.__zipkinOutboundProbeAttached__) return target;
    target.__zipkinOutboundProbeAttached__ = true;
    aspect.around(
      target,
      methods,
      // Before 'http.request' function
      function(obj, methodName, methodArgs, probeData) {
        // Get HTTP request method from options
        if (process.env.JAEGER_ENDPOINT_NOTREADY === 'true'){
          return;
        }
        var options = methodArgs[0];
        var requestMethod = 'GET';
        var urlRequested = '';
        if (typeof options === 'object') {
          if (tool.isIcamInternalRequest(options, headerFilters, pathFilters)){
            return;
          }
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
        let { headers } = Request.addZipkinHeaders(methodArgs[0], tracer.createChildId());
        Object.assign(methodArgs[0].headers, { headers });

        tracer.recordServiceName(serviceName);
        tracer.recordRpc(requestMethod + ' ' + urlRequested);
        tracer.recordBinary('http.url', urlRequested);
        tool.recordIbmapmContext(tracer, ibmapmContext);
        tracer.recordAnnotation(new Annotation.ClientSend());
        console.info('send https-outbound-tracer(before): ', tracer.id);
        // End metrics
        aspect.aroundCallback(
          methodArgs,
          probeData,
          function(target, args, probeData) {
            console.info('confirm:', urlRequested);
            tracer.recordBinary('http.status_code', target.res.statusCode.toString());
            tracer.recordAnnotation(new Annotation.ClientRecv());
            console.info('send https-outbound-tracer(aroundCallback): ', tracer.id);
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
function formatURL(httpsOptions) {
  var url;
  if (httpsOptions.protocol) {
    url = httpsOptions.protocol;
  } else {
    url = 'https:';
  }
  url += '//';
  if (httpsOptions.auth) {
    url += httpsOptions.auth + '@';
  }
  if (httpsOptions.host) {
    url += httpsOptions.host;
  } else if (httpsOptions.hostname) {
    url += httpsOptions.hostname;
    if (httpsOptions.port) {
      url += ':' + httpsOptions.port;
    }
  } else {
    url += 'localhost';
    if (httpsOptions.port) {
      url += ':' + httpsOptions.port;
    }
  }
  if (httpsOptions.path) {
    url += httpsOptions.path;
  } else {
    url += '/';
  }
  return url;
}

module.exports = HttpsOutboundProbeZipkin;
