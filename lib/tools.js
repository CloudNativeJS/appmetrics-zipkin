
'use strict';

module.exports.recordIbmapmContext = function(tracer, ibmapmContext){
  if (ibmapmContext && ibmapmContext.podName) {
    tracer.recordBinary('pod.name', ibmapmContext.podName);
    tracer.recordBinary('container.id', ibmapmContext.containerId);
    tracer.recordBinary('namespace', ibmapmContext.nameSpace);
    tracer.recordBinary('cluster.id', ibmapmContext.clusterID || 'unamedcluster');
    tracer.recordBinary('node.name', ibmapmContext.nodeName);
    tracer.recordBinary('service.name', ibmapmContext.serviceName);

  }
  if (ibmapmContext && ibmapmContext.applicationName) {
    tracer.recordBinary('application.name', ibmapmContext.applicationName);
  }
  if (ibmapmContext && ibmapmContext['resource.id']) {
    tracer.recordBinary('resource.id', ibmapmContext['resource.id']);
  }
  if (ibmapmContext && ibmapmContext.tenantId) {
    tracer.recordBinary('tenant.id', ibmapmContext.tenantId);
  }
  if (ibmapmContext && ibmapmContext.ip) {
    tracer.recordBinary('ip', ibmapmContext.ip);
  }
};

module.exports.isIcamInternalRequest = function(options, headerFilters, pathFilters) {
  if (options.headers) {
    for (var key in headerFilters){
      if (Object.keys(options.headers).indexOf(key) >= 0
        || options.headers[key] === headerFilters[key]){
        return true;
      }
    }
  }
  for (var i = 0; i < pathFilters.length; i++) {
    if (options.path.indexOf(pathFilters[i]) >= 0){
      return true;
    }
  }
  return false;
};
