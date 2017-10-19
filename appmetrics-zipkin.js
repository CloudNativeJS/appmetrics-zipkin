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

var path = require('path');

var aspect = require('./lib/aspect.js');
var fs = require('fs');
var PropertyReader = require('properties-reader');
var properties = PropertyReader(__dirname + '/appmetrics-zipkin.properties');
var tcpp = require('tcp-ping');

const {
  BatchRecorder
} = require('zipkin');
const {
  HttpLogger
} = require('zipkin-transport-http');

// Load module probes into probes array by searching the probes directory.
var probes = [];

var dirPath = path.join(__dirname, 'probes');
var files = fs.readdirSync(dirPath);
var processName = '';

module.exports = function(options) {
  options = options;
  processName = path.basename(process.argv[1]);
  if (processName.includes('.js')) {
    processName = processName.substring(0, processName.length - 3);
  }
  files.forEach(function(fileName) {
    var file = path.join(dirPath, fileName);
    var probeModule = new (require(file))();
    probes.push(probeModule);
  });
  start(options);
};

function start(options) {
  // Set up the zipkin
  var host, port, serviceName;

  if (options) {
    host = options['host'];
    port = options['port'];
    serviceName = options['serviceName'];
  }

  // Uses properties from file if present
  if (properties){
    if (properties.get('host')) {
      host = properties.get('host');
    }
    if (properties.get('port')) {
      port = properties.get('port');
    }
  }

  if (!serviceName) {
    serviceName = processName;
  }
  if (!host) {
    host = 'localhost';
  }
  if (!port) {
    port = 9411;
  }

  // Test if the host & port are valid
  tcpp.probe(host, port, function(err, available) {
    if (err) {
      console.log('Unable to contact Zipkin at ' + host + ':' + port);
      return;
    }
    if (!available) {
      console.log('Unable to contact Zipkin at ' + host + ':' + port);
    }
  });

  const zipkinUrl = `http://${host}:${port}`;
  const recorder = new BatchRecorder({
    logger: new HttpLogger({
      endpoint: `${zipkinUrl}/api/v1/spans`
    })
  });

  // Configure and start the probes
  probes.forEach(function(probe) {
    probe.setConfig(options);
    probe.setRecorder(recorder);
    probe.setServiceName(serviceName);
    probe.start();
    //    probe.enableRequests();
  });
}

/*
 * Patch the module require function to run the probe attach function
 * for any matching module. This loads the monitoring probes into the modules
 */
var data = {};
/* eslint no-proto:0 */
aspect.after(module.__proto__, 'require', data, function(obj, methodName, args, context, ret) {
  if (ret == null || ret.__ddProbeAttached__) {
    return ret;
  } else {
    for (var i = 0; i < probes.length; i++) {
      if (probes[i].name === args[0]) {
        ret = probes[i].attach(args[0], ret, module.exports);
      }
    }
    return ret;
  }
});
