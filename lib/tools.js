
'use strict';

module.exports.recordIbmapmContext = function(tracer, ibmapmContext){
  if (ibmapmContext && ibmapmContext.podName) {
    tracer.recordBinary('podName', ibmapmContext.podName);
    tracer.recordBinary('containerId', ibmapmContext.containerId);
    tracer.recordBinary('nameSpace', ibmapmContext.nameSpace);
    tracer.recordBinary('clusterId', ibmapmContext.clusterId ? ibmapmContext.clusterId : 'unamedcluster');

  } else {
    console.info('call recordProcess: onPremise,yes');
    tracer.recordBinary('onPremise', 'yes');
  }
};

module.exports.isIcamInternalRequest = function(options, headerFilters, pathFilters) {
  console.info(options, headerFilters, pathFilters);
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
