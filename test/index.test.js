'use strict';

const assume = require('assume');
const stream = require('stream');
const TransportStream = require('../');
const Parent = require('./fixtures/parent');
const SimpleTransport = require('./fixtures/simple-transport');
const { logFor, levelAndMessage } = require('abstract-winston-transport/utils');

//
// Order of Levels used in these tests.
// Remark (indexzero): is abstracting this into a helper
// useful in `abstract-winston-transport`?
//
const testOrder = [
  'error',
  'warn',
  'dog',
  'cat',
  'info',
  'verbose',
  'silly',
  'parrot'
];

//
// Actual `testLevels` in the format expected by `winston`.
//
const testLevels = testOrder.reduce(function (acc, level, i) {
  acc[level] = i;
  return acc;
}, {});

describe('TransportStream', function () {
  it('should have the appropriate errors defined', function () {
    const transport = new TransportStream();
    assume(transport).instanceof(stream.Writable);
    assume(transport._write).is.a('function');
    assume(transport.log).equals(undefined);
  });

  it('should accept a custom log function invoked on _write', function () {
    const log = logFor(1);
    const transport = new TransportStream({ log });
    assume(transport.log).equals(log);
  });

  it('should invoke a custom log function on _write', function (done) {
    const info = {
      level: 'test',
      message: 'Testing ... 1 2 3.'
    };

    const transport = new TransportStream({
      log: function (actual) {
        assume(actual).equals(info);
        done();
      }
    });

    transport.write(info);
  });

  describe('when { exception: true } in info', function () {
    it('should not invoke log when { handleExceptions: false }', function (done) {
      const expected = [
        { exception: true, 'message': 'Test exception handling' },
        { level: 'test', message: 'Testing ... 1 2 3.' }
      ];

      const transport = new TransportStream({
        log: function (info) {
          assume(info.exception).equals(undefined);
          done();
        }
      });

      expected.forEach(transport.write.bind(transport));
    });

    it('should invoke log when { handleExceptions: true }', function (done) {
      const actual = [];
      const expected = [
        { exception: true, 'message': 'Test exception handling' },
        { level: 'test', message: 'Testing ... 1 2 3.' }
      ];

      const transport = new TransportStream({
        handleExceptions: true,
        log: function (info, next) {
          actual.push(info);
          if (actual.length === expected.length) {
            assume(actual).deep.equals(expected);
            done();
          }

          next();
        }
      });

      expected.forEach(transport.write.bind(transport));
    });
  });

  describe('levels', function () {
    it('should log to any level when { level: undefined }', function (done) {
      const expected = testOrder.map(levelAndMessage);
      const transport = new TransportStream({
        log: logFor(testOrder.length, function (err, infos) {
          assume(infos.length).equals(expected.length);
          assume(infos).deep.equals(expected);
          done();
        })
      });

      expected.forEach(transport.write.bind(transport));
    });

    it('should only log messages BELOW the level priority', function (done) {
      const expected = testOrder.map(levelAndMessage);
      const transport = new TransportStream({
        level: 'info',
        log: logFor(5, function (err, infos) {
          assume(infos.length).equals(5);
          assume(infos).deep.equals(expected.slice(0, 5));
          done();
        })
      });

      transport.levels = testLevels;
      expected.forEach(transport.write.bind(transport));
    });

    it('level should be ignored when { handleExceptions: true }');
  });

  describe('with parent', function () {
    it('should define { level, levels } on "pipe"', function (done) {
      var parent = new Parent({
        level: 'info',
        levels: testLevels
      });

      var transport = new TransportStream({
        log: function () {}
      });

      parent.pipe(transport);
      setImmediate(function () {
        assume(transport.level).equals('info');
        assume(transport.levels).equals(testLevels);
        assume(transport.parent).equals(parent);
        done();
      });
    });

    it('should not overwrite existing { level } on "pipe"', function (done) {
      var parent = new Parent({
        level: 'info',
        levels: testLevels
      });

      var transport = new TransportStream({
        level: 'error',
        log: function () {}
      });

      parent.pipe(transport);
      setImmediate(function () {
        assume(transport.level).equals('error');
        assume(transport.levels).equals(testLevels);
        assume(transport.parent).equals(parent);
        done();
      });
    });

    it('should unset parent on "unpipe"', function (done) {
      var parent = new Parent({
        level: 'info',
        levels: testLevels
      });

      var transport = new TransportStream({
        level: 'error',
        log: function () {}
      });

      //
      // Trigger "pipe" first so that transport.parent is set
      //
      parent.pipe(transport);
      setImmediate(function () {
        assume(transport.parent).equals(parent);

        //
        // Now verify that after "unpipe" it is set to "null"
        //
        parent.unpipe(transport);
        setImmediate(function () {
          assume(transport.parent).equals(null);
          done();
        });
      });
    });

    it('should invoke a close method on "unpipe"', function (done) {
      var parent = new Parent({
        level: 'info',
        levels: testLevels
      });

      var transport = new TransportStream({
        log: function () {}
      });

      //
      // Test will only successfully complete when `close`
      // is invoked.
      //
      transport.close = function () {
        assume(transport.parent).equals(null);
        done();
      };

      //
      // Trigger "pipe" first so that transport.parent is set
      //
      parent.pipe(transport);
      setImmediate(function () {
        assume(transport.parent).equals(parent);
        parent.unpipe(transport);
      });
    });
  });
});
