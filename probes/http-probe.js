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
var Probe = require('../lib/probe.js');
var aspect = require('../lib/aspect.js');
var request = require('../lib/request.js');
var util = require('util');
var url = require('url');

var path = require('path');

const zipkin = require('zipkin');

const {
  Request,
  HttpHeaders: Header,
  option: {Some, None},
  Annotation,
  TraceId
} = require('zipkin');

// In Node.js, the recommended context API to use is zipkin-context-cls.
const CLSContext = require('zipkin-context-cls');
const ctxImpl = new CLSContext(); // if you want to use CLS
const {
  recorder
} = require('../lib/recorder');

function hasZipkinHeader(httpReq) {
  const headers = httpReq.headers || {};
  return headers[(Header.TraceId).toLowerCase()] !== undefined && headers[(Header.SpanId).toLowerCase()] !== undefined;
}


function HttpProbe() {
  Probe.call(this, 'http');
  this.config = {
    filters: [],
  };
}
util.inherits(HttpProbe, Probe);


function stringToBoolean(str) {
  return str === '1';
}

function stringToIntOption(str) {
  try {
    return new Some(parseInt(str));
  } catch (err) {
    return None;
  }
}

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

            if (hasZipkinHeader(httpReq)) {
              const headers = httpReq.headers;
              var spanId = headers[(Header.SpanId).toLowerCase()];
              if (spanId !== undefined) {
                const traceId = new Some(headers[(Header.TraceId).toLowerCase()]);
                const parentSpanId = new Some(headers[(Header.ParentSpanId).toLowerCase()]);
                const sampled = new Some(headers[(Header.Sampled).toLowerCase()]);
                const flags = (new Some(headers[(Header.Flags).toLowerCase()])).flatMap(stringToIntOption).getOrElse(0);
                var id = new TraceId({
                  traceId: traceId,
                  parentId: parentSpanId,
                  spanId: spanId,
                  sampled: sampled.map(stringToBoolean),
                  flags
                });
                tracer.setId(id);
                probeData.traceId = tracer.id;
              };
            } else {
              tracer.setId(tracer.createRootId());
              probeData.traceId = tracer.id;
              Request.addZipkinHeaders(args[0], tracer.id);
            }

            that.requestProbeStart(probeData, httpReq.method, traceUrl);

            tracer.recordServiceName(getServiceName());
            tracer.recordRpc(method.toUpperCase());
            tracer.recordBinary('http.url', httpReq.headers.host + traceUrl);
            tracer.recordAnnotation(new Annotation.ServerRecv());
            tracer.recordAnnotation(new Annotation.LocalAddr(0));


            aspect.after(res, 'end', probeData, function(obj, methodName, args, probeData, ret) {
              tracer.recordBinary('http.status_code', res.statusCode.toString());
              tracer.recordAnnotation(new Annotation.ServerSend());

              that.requestProbeEnd(probeData, httpReq.method, traceUrl, res, httpReq);
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

function getServiceName() {
 // var serviceName = this.config[serviceName];
 // console.log("JS getServiceName="+serviceName);
//  if (serviceName !== undefined) {
    var serviceName = path.basename(process.argv[1]);
    if (serviceName.includes(".js")) {
      serviceName = serviceName.substring(0, serviceName.length - 3);
    }
//  }
  return serviceName;
}

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

HttpProbe.prototype.requestStart = function (probeData, method, url) {
    var reqType = 'http';
    // Mark as a root request as this happens due to an external event
    probeData.req = request.startRequest(reqType, url, true, probeData.timer, probeData.traceId );
};

HttpProbe.prototype.requestEnd = function (probeData, method, url, res, httpReq) {
    if(probeData && probeData.req)
        probeData.req.stop({url: url, method: method, requestHeader: httpReq.headers, statusCode: res.statusCode, header: res._header, contentType: res.getHeader('content-type')});
};

module.exports = HttpProbe;
