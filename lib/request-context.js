'use strict';

let semver = require('semver');
let asyncHooks;

if (semver.gte(process.version, '8.0.0')) {
  asyncHooks = require('async_hooks');
}
const Namespace = require('./namespace');

const namespaces = {};

function createHooks(namespace) {
  function init(asyncId, type, triggerId, resource) {
    if (namespace.context[triggerId]) {
      namespace.context[asyncId] = namespace.context[triggerId];
    }
  }

  function destroy(asyncId) {
    delete namespace.context[asyncId];
  }

  const asyncHook = asyncHooks.createHook({
    init,
    destroy
  });

  asyncHook.enable();
}

function createNamespace(name) {
  if (namespaces[name]) {
    return namespace;
  }

  const namespace = new Namespace();
  namespaces[name] = namespace;

  if (semver.gte(process.version, '8.0.0')) {
    createHooks(namespace);
  }
  return namespace;
}

function getNamespace(name) {
  return namespaces[name];
}


module.exports = {
  createNamespace,
  getNamespace
};
