/*******************************************************************************
 * Copyright 2017 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 ******************************************************************************/

'use strict';

const debug = require('debug')('appmetrics-zipkin');
const util = require('util');

exports.attach = function(options) {
  console.log("[appmetrics-zipkin] exports.attach");
  // Protect our options from modification.
  options = util._extend({}, options);

  // if the user hasn't supplied appmetrics, require
  // here so we get http probe data
  if (!options.appmetrics) {
    options.appmetrics = require('appmetrics');
  }

  return exports;
};

// Start monitoring process and subscribe to the data.
// Don't export monitor
var monitor = function(options) {
  // Protect our options from modification.
  options = util._extend({}, options);

  options.console = options.console || console;

  // appmetrics is a global singleton, allow the user's appmetrics to be
  // injected, only using our own if the user did not supply one.
  var appmetrics = options.appmetrics || require('appmetrics');
  var monitoring = appmetrics.monitor();

  console.log("[appmetrics-zipkin] monitor");
};
