
'use strict';

module.exports.recordIbmapmContext = function(tracer, ibmapmContext){
  if (ibmapmContext && ibmapmContext.podName) {
    tracer.recordBinary('podName', ibmapmContext.podName);
    tracer.recordBinary('containerId', ibmapmContext.containerId);
    tracer.recordBinary('nameSpace', ibmapmContext.nameSpace);
    tracer.recordBinary('clusterId', ibmapmContext.clusterId ? ibmapmContext.clusterId : 'unamedcluster');
  }
};

module.exports.addJaegerHeaders = function(req, traceId, message) {
  const headers = req.headers || {};

  var headerKeys = [
    traceId.traceId,
    traceId.spanId,
    traceId._parentId.value ? traceId._parentId.value : '0',
    traceId.sampled.value ? 1 : 0
  ];
  headers['ibm-apm-spancontext'] = headerKeys.join(':');
  console.info(message + ' ibm-apm-spancontext: ', headers['ibm-apm-spancontext']);

  return Object.assign({}, req, {headers});
};

module.exports.hasJaegerHeader = function(httpReq) {
  const headers = httpReq.headers || {};
  return headers['ibm-apm-spancontext'] !== undefined;
};
