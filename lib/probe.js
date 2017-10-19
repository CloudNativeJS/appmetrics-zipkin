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
'use strict';

var timer = require('./timer.js');
// Default to metrics on once probe has been started
var _enabled = true;

// Not running by default
var _started = false;

function Probe(name) {
  this.name = name;
  this.config = {};
  this.recorder = {};
  this.serviceName = '';
}

/*
 * Function to add instrumentation to the target module
 */
Probe.prototype.attach = function(name, target) {
  return target;
};

/*
 * Set configuration by merging passed in config with current one
 */
Probe.prototype.setConfig = function(newConfig) {
  for (var prop in newConfig) {
    if (typeof (newConfig[prop]) !== 'undefined') {
      this.config[prop] = newConfig[prop];
    }
  }
};

Probe.prototype.setRecorder = function(recorder) {
  this.recorder = recorder;
};

Probe.prototype.setServiceName = function(name) {
  this.serviceName = name;
};

/*
 * Lightweight metrics probes
 */
Probe.prototype.metricsStart = function(probeData) {
  probeData.timer = timer.start();
};

// Implentors should stop the timer and emit an event.
Probe.prototype.metricsEnd = function(probeData) {
  probeData.timer.stop();
};

/*
 * Default to metrics off until started
 */
Probe.prototype.metricsProbeStart = function(req, res, am) {};
Probe.prototype.metricsProbeEnd = function(req, res, am) {};

Probe.prototype.enable = function() {
  _enabled = true;
  if (_started) {
    this.metricsProbeStart = this.metricsStart;
    this.metricsProbeEnd = this.metricsEnd;
  }
};

Probe.prototype.disable = function() {
  this.metricsProbeStart = function() {};
  this.metricsProbeEnd = function() {};
};

Probe.prototype.start = function() {
  _started = true;
  if (_enabled) {
    this.metricsProbeStart = this.metricsStart;
    this.metricsProbeEnd = this.metricsEnd;
  }
};

Probe.prototype.stop = function() {
  _started = false;
  this.metricsProbeStart = function() {};
  this.metricsProbeEnd = function() {};
  this.requestProbeStart = function() {};
  this.requestProbeEnd = function() {};
};

module.exports = Probe;
