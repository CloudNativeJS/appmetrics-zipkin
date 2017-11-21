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

**Note**: `require('appmetrics-zipkin')` must be included before requiring other packages to ensure those packages are correctly instrumented. Failure to do can result in spans not being sent to the Zipkin server.

## Using Zipkin with Node.js and Kubernetes
Deploy the Zipkin service with a given service name and exposure type, for example, naming the service `zipkin` and choosing to expose the service via the `NodePort` mechanism.

Your Node.js code to send Zipkin traffic to the discovered server would be as follows:
```
var zipkinHost = "localhost"
var zipkinPort = 9411  

if (process.env.ZIPKIN_SERVICE_HOST && process.env.ZIPKIN_SERVICE_PORT) {
  console.log("Routing Zipkin traffic to the Zipkin Kubernetes service")
  zipkinHost = process.env.ZIPKIN_SERVICE_HOST
  zipkinPort = process.env.ZIPKIN_SERVICE_PORT
} else {
  console.log("Detected we're running the Zipkin server locally")
}

var appzip = require('appmetrics-zipkin')({
  host: zipkinHost,
  port: zipkinPort,
  serviceName:'my-kube-frontend'
});
```

You can see if the environment variables are present with the following commands.

Use `kubectl get pods` to discover the pod of your Zipkin deployment.

Use `kubectl exec -it <the pod name from above> printenv | grep SERVICE` to determine the environment variables present for the Zipkin service.

Example output:
```
[Node.js@IBM icp-nodejs-sample]$ kubectl exec -it test-zipkin-289126497-pjf5b printenv | grep SERVICE
ZIPKIN_SERVICE_HOST=10.0.0.105
ZIPKIN_SERVICE_PORT=9411
```
