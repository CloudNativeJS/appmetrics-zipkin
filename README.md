# appmetrics-zipkin

appmetrics-zipkin provides [Zipkin](https://github.com/openzipkin/zipkin) instrumentation of Node.js applications using a single line: `require('appmetrics-zipkin')`. 

Unlike other zipkin instrumentation packages, appmetrics-zipkin will automatically inject missing trace header information into any inbound request and use the same value for the outbound request without any user intervention. This gives you a full trace across the http message with out any extra code.

## Configure Zipkin Endpoint
Connecting to a [Zipkin](https://github.com/openzipkin/zipkin) endpoint is done by adding the desired hostname and port to `appmetrics-zipkin.properties` file.

Alternatively, the hostname, port and service name (used by Zipkin to identify your application) can be added when including appmetrics-zipkin into your application:

```
var appzip = require('appmetrics-zipkin')({
  host: 'localhost',
  port: 9411,
  serviceName:'frontend'
});
```

**Note**: The properties file has precedence over the inline settings

If no configuration details are provided, the endpoint will be _localhost:9411_ and the serviceName will be set to the program name that requires appmetrics-zipkin.


## Usage
```
var appzip = require('appmetrics-zipkin');
var express = require('express');
var app = express();


app.get('/api', (req, res) => res.send(new Date().toString()));
app.listen(9000, () => {
  console.log('Backend listening on port 9000!');
});
```

**Note**: `require('appmetrics-zipkin')` should be included before requiring other packages to ensure those packages are correctly instrumented
