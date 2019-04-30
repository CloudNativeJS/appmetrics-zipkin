'use strict';
var uuid = require('uuid');
var https = require('https');
var url = require('url');
var commonTools = require('../../lib/tool/common.js');

var log4js = require('log4js');
var logger = log4js.getLogger('knj_log');
var _createClass = function() { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function(Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _require = require('zipkin');
var JSON_V1 = _require.jsonEncoder.JSON_V1;

var HttpsLogger = function() {
  function HttpsLogger(_ref) {
    var _this = this;

    var endpoint = _ref.endpoint;
    var _ref$httpInterval = _ref.httpInterval;
    var httpInterval = _ref$httpInterval === undefined ? 1000 : _ref$httpInterval;
    var _ref$jsonEncoder = _ref.jsonEncoder;
    var jsonEncoder = _ref$jsonEncoder === undefined ? JSON_V1 : _ref$jsonEncoder;

    _classCallCheck(this, HttpsLogger);

    this.endpoint = endpoint;
    this.pfx = _ref.pfx;
    this.passphase = _ref.passphase;
    this.queue = [];
    this.jsonEncoder = jsonEncoder;

    var timer = setInterval(function() {
      _this.processQueue();
    }, httpInterval);
    if (timer.unref) {
      // unref might not be available in browsers
      timer.unref(); // Allows Node to terminate instead of blocking on timer
    }
  }

  _createClass(HttpsLogger, [{
    key: 'logSpan',
    value: function logSpan(span) {
      this.queue.push(this.jsonEncoder.encode(span));
    }
  }, {
    key: 'processQueue',
    value: function processQueue() {
      if (this.queue.length > 0) {
        var postBody = '[' + this.queue.join(',') + ']';
        var options = url.parse(this.endpoint);
        var header = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-TransactionID': uuid.v1(),
          'User-Agent': 'NodeDC'
        };
        if (process.env.APM_TENANT_ID) {
          header['X-TenantId'] = process.env.APM_TENANT_ID;
        }
        var finalOptions = {
          hostname: options.hostname,
          host: options.host,
          port: options.port,
          path: options.path,
          protocol: options.protocol,
          pfx: this.pfx,
          passphrase: this.passphase,
          ca: this.pfx,
          requestCert: true,
          rejectUnauthorized: false,
          method: 'POST',
          headers: header
        };
        commonTools.tlsFix8(finalOptions);
        try {
          var req = https.request(finalOptions, function(res){
            if (res.statusCode === 202)
              logger.debug('Send to Jaeger server successfully: ', postBody);
            else
              logger.warn('Failed to sent to Jaeger server. statusCode=', res.statusCode, 'options=', finalOptions);
          });
          req.on('error', function(err){
            logger.error('Failed to sent to Jaeger server');
            logger.error(err);
          });
          req.write(postBody);
          req.end();
        } catch (e) {
          logger.error('Failed to sent to Jaeger server');
          logger.error(e);
        }
        this.queue.length = 0;
      }
    }
  }]);

  return HttpsLogger;
}();

module.exports = HttpsLogger;
