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
var am = require('../');

var path = require('path');
var serviceName = path.basename(process.argv[1]);
if (serviceName.includes(".js")) {
  serviceName = serviceName.substring(0,serviceName.length-3);
}
 
const zipkin = require('zipkin');
const {Request, Annotation} = require('zipkin');

// In Node.js, the recommended context API to use is zipkin-context-cls.
const CLSContext = require('zipkin-context-cls');
const ctxImpl = new CLSContext(); // if you want to use CLS
const {recorder} = require('../recorder');

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
	if( name == 'http' ) {
		if(target.__probeAttached__) return target;
	    target.__probeAttached__ = true;
        var methods = ['on', 'addListener'];

	    aspect.before(target.Server.prototype, methods,
	      function(obj, methodName, args, probeData) {
	        if(args[0] !== 'request') return;
	        if(obj.__httpProbe__) return;
	        obj.__httpProbe__ = true;
	        aspect.aroundCallback(args, probeData, function(obj, args, probeData) {
	            var httpReq = args[0];
	            var res = args[1];

                // Filter out urls where filter.to is ''
	            var traceUrl = that.filterUrl(httpReq);
	            if (traceUrl !== '') {
                    const method = httpReq.method;
					tracer.setId(tracer.createChildId());
				    tracer.recordServiceName(serviceName);
				    tracer.recordRpc(method.toUpperCase());
				    tracer.recordBinary('http.url', httpReq.headers.referer);
				    tracer.recordAnnotation(new Annotation.ServerRecv());
                    tracer.recordAnnotation(new Annotation.LocalAddr(0));

	            	that.metricsProbeStart(probeData, httpReq.method, traceUrl);
	            	that.requestProbeStart(probeData, httpReq.method, traceUrl);
	                aspect.after(res, 'end', probeData, function(obj, methodName, args, probeData, ret) {
                        Request.addZipkinHeaders(res, tracer.id);
						tracer.recordBinary('http.status_code', res.statusCode.toString());
						tracer.recordAnnotation(new Annotation.ServerSend());

                        that.metricsProbeEnd(probeData, httpReq.method, traceUrl, res, httpReq);
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
var parse = function (url) {
	['?','#'].forEach(function (separator)  {
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

/*
 * Lightweight metrics probe for HTTP requests
 *
 * These provide:
 * 		time:		time event started
 * 		method:		HTTP method, eg. GET, POST, etc
 * 		url:		The url requested
 * 		duration:	the time for the request to respond
 */

HttpProbe.prototype.metricsEnd = function(probeData, method, url, res, httpReq) {
    if(probeData && probeData.timer) {
	    probeData.timer.stop();
	    am.emit('http', {time: probeData.timer.startTimeMillis, method: method, url: url, duration: probeData.timer.timeDelta, header: res._header, statusCode: res.statusCode, contentType: res.getHeader('content-type'), requestHeader: httpReq.headers});
    }
};

/*
 * Heavyweight request probes for HTTP requests
 */

HttpProbe.prototype.requestStart = function (probeData, method, url) {
    var reqType = 'http';
    // Mark as a root request as this happens due to an external event
    probeData.req = request.startRequest(reqType, url, true, probeData.timer);
};

HttpProbe.prototype.requestEnd = function (probeData, method, url, res, httpReq) {
    if(probeData && probeData.req)
        probeData.req.stop({url: url, method: method, requestHeader: httpReq.headers, statusCode: res.statusCode, header: res._header, contentType: res.getHeader('content-type')});
};

/*
 * Set configuration by merging passed in config with current one
 */
HttpProbe.prototype.setConfig = function (newConfig) {
	if (typeof(newConfig.filters) !== 'undefined') {
		newConfig.filters.forEach(function(filter) {
			if (typeof(filter.regex) === 'undefined') {
				filter.regex = new RegExp(filter.pattern);
			}
		});
	}
	for (var prop in newConfig) {
		if (typeof(newConfig[prop]) !== 'undefined') {
			this.config[prop] = newConfig[prop];
		}
	}
};

module.exports = HttpProbe;
