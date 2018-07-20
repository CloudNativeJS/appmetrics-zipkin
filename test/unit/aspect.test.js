'use strict';

const { expect } = require('chai');
const { stub } = require('sinon');
const { before, after, around, findCallbackArg, aroundCallback } = require('../../lib/aspect');
describe('aspect', () => {
  describe('before', () => {
    it('should call hook before target method', () => {
      const origStub = stub();
      const hookStub = stub();
      const testObj = { a: origStub };
      before(testObj, ['a'], hookStub);
      testObj.a();
      expect(hookStub.calledBefore(origStub)).to.be.ok;
    });
    it('should pass original arguments', () => {
      const origStub = stub();
      const hookStub = stub();
      const testObj = { a: origStub };
      before(testObj, ['a'], hookStub);
      const testString = 'This is a test string';
      testObj.a(testString);
      expect(origStub.calledWith(testString)).to.be.ok;
    });
  });
  describe('after', () => {
    it('should call hook after target method', () => {
      const origStub = stub();
      const hookStub = stub();
      const testObj = { a: origStub };
      after(testObj, ['a'], {}, hookStub);
      testObj.a();
      expect(origStub.calledBefore(hookStub)).to.be.ok;
    });
  });
  describe('findCallbackArg', () => {
    it('should find a callback among parameters', () => {
      const args = ['a', {}, () => {}, 123];
      expect(findCallbackArg(args)).to.eq(2);
    });
    it('should not find a callback among parameters with no callback', () => {
      const args = ['a', {}, 123];
      expect(findCallbackArg(args) == undefined).to.be.ok;
    });
  });
  describe('aroundCallBack', () => {
    xit('should call hook before and after args callback', () => { // This is broken
      const origStub = stub();
      const hookBeforeStub = stub();
      const hookAfterStub = stub();
      const args = ['a', {}, origStub, 123];
      aroundCallback(args, {}, hookBeforeStub, hookAfterStub);
      args[2]();
      expect(hookAfterStub.calledBefore(origStub)).to.be.ok;
      expect(origStub.calledBefore(hookAfterStub)).to.be.ok;
    });
  });
  describe('around', () => {
    it('should call hook before and after target methods', () => {
      const origStub = stub();
      const hookBeforeStub = stub();
      const hookAfterStub = stub();
      const testObj = { a: origStub };
      around(testObj, ['a'], hookBeforeStub, hookAfterStub);
      testObj.a();
      expect(hookBeforeStub.calledBefore(origStub)).to.be.ok;
      expect(origStub.calledBefore(hookAfterStub)).to.be.ok;
    });
  });
});
