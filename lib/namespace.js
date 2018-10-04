'use strict';

let semver = require('semver');
let asyncHooks;

if (semver.gte(process.version, '8.0.0')) {
  asyncHooks = require('async_hooks');
}

class Namespace {

  constructor() {
    this.context = {};
  }

  run(fn) {
    if (asyncHooks) {
      const eid = asyncHooks.executionAsyncId();
      this.context[eid] = {};
    }
    fn();
  }

  set(key, val) {
    if (asyncHooks) {
      const eid = asyncHooks.executionAsyncId();
      this.context[eid][key] = val;
    } else {
      this.context[key] = val;
    }
  }

  get(key) {
    if (asyncHooks) {
      const eid = asyncHooks.executionAsyncId();
      if (this.context[eid])
        return this.context[eid][key];
      else
        return undefined;
    } else {
      return this.context[key];
    }
  }
}

module.exports = Namespace;
