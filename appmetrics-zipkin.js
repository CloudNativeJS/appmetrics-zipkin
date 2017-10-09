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
var path = require("path")
var module_dir = path.dirname(module.filename)
var os = require("os")
var aspect = require('./lib/aspect.js');
var request = require('./lib/request.js');
var fs = require('fs');
var util = require('util');

/*
 * Load module probes into probes array by searching the probes directory.
 * We handle the 'trace' probe as a special case because we don't want to put
 * the probe hooks in by default due to the performance cost.
 */
var probes = [];
var traceProbe;
var options;

var dirPath = path.join(__dirname, 'probes');
// console.log("dirpath " + dirPath);
var files = fs.readdirSync(dirPath);
// console.log("files is" + util.inspect(files));
files.forEach(function(fileName) {
  var file = path.join(dirPath, fileName);
  var probeModule = new(require(file))();
  probes.push(probeModule);
});

function start(options) {
  // Configure and start the probes
  probes.forEach(function (probe) {
    console.log("JS before probe.setConfig options=" + util.inspect(options));
    probe.setConfig(options);
    probe.start();
    probe.enableRequests();
  });
}

/*
 * Patch the module require function to run the probe attach function
 * for any matching module. This loads the monitoring probes into the modules
 */
var data = {};

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

exports.configure = function(options) {
    console.log("JS zipkin configure options=" + util.inspect(options));
    options = options;
    start(options);
}
