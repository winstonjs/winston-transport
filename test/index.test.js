'use strict';

const assume = require('assume');
const { format } = require('logform');
const stream = require('stream');
const TransportStream = require('../');
const Parent = require('./fixtures/parent');
const SimpleTransport = require('./fixtures/simple-transport');
const { testLevels, testOrder } = require('./fixtures');
const {
  infosFor,
  logFor,
  levelAndMessage,
  toException,
  toWriteReq
} = require('abstract-winston-transport/utils');
const LEVEL = Symbol.for('level');

describe('TransportStream', function () {
  it('should have the appropriate methods defined', function () {
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
      [LEVEL]: 'test',
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

  describe('_write(info, enc, callback)', function () {
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

    it('{ level } should be ignored when { handleExceptions: true }', function () {
      const expected = testOrder.map(levelAndMessage)
        .map(function (info) {
          info.exception = true;
          return info;
        });

      const transport = new TransportStream({
        level: 'info',
        log: logFor(testOrder.length, function (err, infos) {
          assume(infos.length).equals(expected.length);
          assume(infos).deep.equals(expected);
          done();
        })
      });

      transport.levels = testLevels;
      expected.forEach(transport.write.bind(transport));
    });

    describe('when { exception: true } in info', function () {
      it('should not invoke log when { handleExceptions: false }', function (done) {
        const expected = [
          { exception: true, [LEVEL]: 'error', level: 'error', message: 'Test exception handling' },
          { [LEVEL]: 'test', level: 'test', message: 'Testing ... 1 2 3.' }
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
          { exception: true, [LEVEL]: 'error', level: 'error', message: 'Test exception handling' },
          { [LEVEL]: 'test', level: 'test', message: 'Testing ... 1 2 3.' }
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
  });

  describe('_writev(chunks, callback)', function () {
    it('invokes .log() for each of the valid chunks when necessary in streams plumbing', function (done) {
      const expected = infosFor({ count: 50, levels: testOrder });
      const transport = new TransportStream({
        log: logFor(50 * testOrder.length, function (err, infos) {
          assume(infos.length).equals(expected.length);
          assume(infos).deep.equals(expected);
          done();
        })
      });

      //
      // Make the standard _write throw to ensure that _writev is called.
      //
      transport._write = function () {
        throw new Error('TransportStream.prototype._write should never be called.');
      };

      transport.cork();
      expected.forEach(transport.write.bind(transport));
      transport.uncork();
    });

    it('invokes .logv with all valid chunks when necessary in streams plumbing', function () {
      const expected = infosFor({ count: 50, levels: testOrder });
      const transport = new TransportStream({
        level: 'info',
        log: function () {
          throw new Error('.log() should never be called');
        },
        logv: function (chunks, callback) {
          assume(chunks.length).equals(250);
          callback();
        }
      });

      //
      // Make the standard _write throw to ensure that _writev is called.
      //
      transport._write = function () {
        throw new Error('TransportStream.prototype._write should never be called.');
      };

      transport.cork();
      transport.levels = testLevels;
      expected.forEach(transport.write.bind(transport));
      transport.uncork();
    });
  });

  describe('parent (i.e. "logger") ["pipe", "unpipe"]', function () {
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

  describe('_accept(info)', function () {
    it('should filter only log messages BELOW the level priority', function () {
      const expected = testOrder
        .map(levelAndMessage)
        .map(toWriteReq);

      const transport = new TransportStream({ level: 'info' });
      transport.levels = testLevels;

      const filtered = expected.filter(transport._accept, transport)
        .map(function (write) { return write.chunk.level });

      assume(filtered).deep.equals([
        'error',
        'warn',
        'dog',
        'cat',
        'info'
      ]);
    });

    it('should filter out { exception: true } when { handleExceptions: false }', function () {
      const expected = testOrder
        .map(toException)
        .map(toWriteReq);

      const transport = new TransportStream({
        handleExceptions: false,
        level: 'info'
      });

      transport.levels = testLevels;

      const filtered = expected.filter(transport._accept, transport)
        .map(function (info) { return info.level });

      assume(filtered).deep.equals([]);
    });

    it('should include ALL { exception: true } when { handleExceptions: true }', function () {
      const expected = testOrder
        .map(toException)
        .map(toWriteReq);

      const transport = new TransportStream({
        handleExceptions: true,
        level: 'info'
      });

      transport.levels = testLevels;

      const filtered = expected.filter(transport._accept, transport)
        .map(function (write) { return write.chunk.level });

      assume(filtered).deep.equals(testOrder);
    });
  });

  describe('{ format }', function () {
    it('logs the output of the provided format', function (done) {
      const expected = { [LEVEL]: 'info', level: 'info', message: 'there will be json' };
      const transport = new TransportStream({
        format: format.json(),
        log: function (info, next) {
          assume(info.raw).equals(
            JSON.stringify(expected)
          );

          done();
        }
      });

      transport.write(expected);
    });

    it('treats the original object immutable', function (done) {
      const expected = { [LEVEL]: 'info', level: 'info', message: 'there will be json' };
      const transport = new TransportStream({
        format: format.json(),
        log: function (info, next) {
          assume(info).not.equals(expected);
          done();
        }
      });

      transport.write(expected);
    });
  });
});
