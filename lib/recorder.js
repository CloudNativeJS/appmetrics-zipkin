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
 /* eslint-env browser */
//const {BatchRecorder, ConsoleRecorder} = require('zipkin');
const {BatchRecorder} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');

// Send spans to Zipkin asynchronously over HTTP
const zipkinBaseUrl = 'http://localhost:9411';
const recorder = new BatchRecorder({
 logger: new HttpLogger({
   endpoint: `${zipkinBaseUrl}/api/v1/spans`
 })
});

//const recorder = new ConsoleRecorder();

module.exports.recorder = recorder;
