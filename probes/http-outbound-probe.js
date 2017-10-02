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
var request = require('../lib/request.js');
var util = require('util');
var url = require('url');
var semver = require('semver');

var path = require('path');
var serviceName = path.basename(process.argv[1]);
if (serviceName.includes(".js")) {
  serviceName = serviceName.substring(0, serviceName.length - 3);
}

const zipkin = require('zipkin');
const {
  Request,
  Annotation
} = require('zipkin');

// In Node.js, the recommended context API to use is zipkin-context-cls.
const CLSContext = require('zipkin-context-cls');
const ctxImpl = new CLSContext(); // if you want to use CLS
const {
  recorder
} = require('../lib/recorder');

var methods;
// In Node.js < v8.0.0 'get' calls 'request' so we only instrument 'request'
if (semver.lt(process.version, '8.0.0')) {
  methods = ['request'];
} else {
  methods = ['request', 'get'];
}

// Probe to instrument outbound http requests

function HttpOutboundProbe() {
  Probe.call(this, 'http'); // match the name of the module we're instrumenting
}
util.inherits(HttpOutboundProbe, Probe);

function getRequestItems(options) {
  var returnObject = {
    requestMethod: 'GET',
    urlRequested: '',
    headers: ''
  };
  if (options !== null) {
    var parsedOptions;
    switch (typeof options) {
      case 'object':
        returnObject.urlRequested = formatURL(options);
        parsedOptions = options;
        break;
      case 'string':
        returnObject.urlRequested = options;
        parsedOptions = url.parse(options);
        break;
    }
    if (parsedOptions.method) {
      returnObject.requestMethod = parsedOptions.method;
    }
    if (parsedOptions.headers) {
      returnObject.headers = parsedOptions.headers;
    }
  }
  return returnObject;
}

HttpOutboundProbe.prototype.attach = function(name, target) {
  const tracer = new zipkin.Tracer({
    ctxImpl,
    recorder: recorder,
    sampler: new zipkin.sampler.CountingSampler(0.01), // sample rate 0.01 will sample 1 % of all incoming requests
    traceId128Bit: true // to generate 128-bit trace IDs.
  });
  var that = this;
  if (name === 'http') {
    if (target.__outboundProbeAttached__) return target;
    target.__outboundProbeAttached__ = true;
    aspect.around(
      target,
      methods,
      // Before 'http.request' function
      function(obj, methodName, methodArgs, probeData) {
        // Start metrics
        var ri = getRequestItems(methodArgs[0]);
        // console.log(util.inspect(ri));
        tracer.setId(tracer.createChildId());
        tracer.recordServiceName(serviceName);
        tracer.recordRpc(ri.requestMethod);
        tracer.recordBinary('http.url', ri.urlRequested);
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

module.exports = HttpOutboundProbe;
