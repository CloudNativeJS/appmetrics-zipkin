/*******************************************************************************
 * Copyright 2015 IBM Corp.
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
var Probe = require('../lib/probe.js');
var aspect = require('../lib/aspect.js');
var request = require('../lib/request.js');
var util = require('util');
var url = require('url');

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

function HttpProbe() {
  Probe.call(this, 'http');
  this.config = {
    filters: []
  };
}
util.inherits(HttpProbe, Probe);

HttpProbe.prototype.attach = function(name, target) {
  const tracer = new zipkin.Tracer({
    ctxImpl,
    recorder: recorder,
    sampler: new zipkin.sampler.CountingSampler(0.01), // sample rate 0.01 will sample 1 % of all incoming requests
    traceId128Bit: true // to generate 128-bit trace IDs.
  });

  var that = this;
  if (name == 'http') {
    if (target.__probeAttached__) return target;
    target.__probeAttached__ = true;
    var methods = ['on', 'addListener'];

    aspect.before(target.Server.prototype, methods,
      function(obj, methodName, args, probeData) {
        if (args[0] !== 'request') return;
        if (obj.__httpProbe__) return;
        obj.__httpProbe__ = true;
        aspect.aroundCallback(args, probeData, function(obj, args, probeData) {
          var httpReq = args[0];
          var res = args[1];
          // Filter out urls where filter.to is ''
          var traceUrl = that.filterUrl(httpReq);
          // console.log(util.inspect(httpReq));
          if (traceUrl !== '') {
            const method = httpReq.method;
            tracer.setId(tracer.createChildId());
            tracer.recordServiceName(serviceName);
            tracer.recordRpc(method.toUpperCase());
            tracer.recordBinary('http.url', httpReq.headers.host + traceUrl);
            tracer.recordAnnotation(new Annotation.ServerRecv());
            tracer.recordAnnotation(new Annotation.LocalAddr(0));
            aspect.after(res, 'end', probeData, function(obj, methodName, args, probeData, ret) {
              Request.addZipkinHeaders(res, tracer.id);
              tracer.recordBinary('http.status_code', res.statusCode.toString());
              tracer.recordAnnotation(new Annotation.ServerSend());
            });
          }
        });
      });
  }
  return target;
};

function constructUrl(req) {
  const parsed = url.parse(req.originalUrl);
  return url.format({
    protocol: req.protocol,
    host: req.get('host'),
    pathname: parsed.pathname,
    search: parsed.search
  });
}



/*
 * Custom req.url parser that strips out any trailing query
 */
var parse = function(url) {
  ['?', '#'].forEach(function(separator) {
    var index = url.indexOf(separator);
    if (index !== -1) url = url.substring(0, index);
  });
  return url;
};

/*
 * Ignore requests for URLs which we've been configured via regex to ignore
 */
HttpProbe.prototype.filterUrl = function(req) {
  var resultUrl = parse(req.url);
  var filters = this.config.filters;
  if (filters.length == 0) return resultUrl;

  var identifier = req.method + ' ' + resultUrl;
  for (var i = 0; i < filters.length; ++i) {
    var filter = filters[i];
    if (filter.regex.test(identifier)) {
      return filter.to;
    }
  }
  return resultUrl;
}


module.exports = HttpProbe;
