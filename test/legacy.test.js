'use strict';

const assume = require('assume');
const stream = require('stream');
const LegacyTransportStream = require('../legacy');
const Parent = require('./fixtures/parent');
const LegacyTransport = require('./fixtures/legacy-transport');
const { testLevels, testOrder } = require('./fixtures');
const { infosFor, logFor, levelAndMessage } = require('abstract-winston-transport/utils');
const LEVEL = Symbol.for('level');

//
// Silence the deprecation notice for sanity in test output.
// TODO: Test coverage for the deprecation notice because why not?
//
const deprecated = {
  original: LegacyTransportStream.prototype._deprecated,
  silence: function () {
    LegacyTransportStream.prototype._deprecated = function () {};
  },
  restore: function () {
    LegacyTransportStream.prototype._deprecated = this.original;
  }
};

describe('LegacyTransportStream', function () {
  let legacy;
  let transport;

  before(deprecated.silence);
  beforeEach(function () {
    legacy = new LegacyTransport();
    transport = new LegacyTransportStream({ transport: legacy });
  });

  it('should have the appropriate methods defined', function () {
    assume(transport).instanceof(stream.Writable);
    assume(transport._write).is.a('function');
    assume(transport.log).equals(undefined);
  });

  it('should error with no transport', function () {
    assume(function () {
      transport = new LegacyTransportStream();
      assume(transport).instanceof(stream.Writable);
    }).throws(/Invalid transport, must be an object with a log method./);
  });

  it('should error with invalid transport', function () {
    assume(function () {
      transport = new LegacyTransportStream();
      assume(transport).instanceof(stream.Writable);
    }).throws(/Invalid transport, must be an object with a log method./);
  });

  it('should display a deprecation notice', function (done) {
    deprecated.restore();
    const error = console.error;
    console.error = function (msg) {
      assume(msg).to.include('is a legacy winston transport. Consider upgrading');
      setImmediate(done);
    };

    legacy = new LegacyTransport();
    transport = new LegacyTransportStream({ transport: legacy });
    console.error = error;
    deprecated.silence();
  });

  it('sets __winstonError on the LegacyTransport instance', function () {
    assume(legacy.__winstonError).is.a('function');
    assume(legacy.listeners('error')).deep.equals([
      legacy.__winstonError
    ]);
  });

  it('emits an error on LegacyTransport error', function (done) {
    const err = new Error('Pass-through from stream');

    transport.on('error', function (actual) {
      assume(err).equals(actual);
      done();
    });

    legacy.emit('error', err);
  });

  describe('_write(info, enc, callback)', function () {
    it('should log to any level when { level: undefined }', function (done) {
      const expected = testOrder.map(levelAndMessage);

      legacy.on('logged', logFor(testOrder.length, function (err, infos) {
        assume(infos.length).equals(expected.length);
        assume(infos).deep.equals(expected);
        done();
      }));

      expected.forEach(transport.write.bind(transport));
    });

    it('should only log messages BELOW the level priority', function (done) {
      const expected = testOrder.map(levelAndMessage);
      transport = new LegacyTransportStream({
        level: 'info',
        transport: legacy
      });

      legacy.on('logged', logFor(5, function (err, infos) {
        assume(infos.length).equals(5);
        assume(infos).deep.equals(expected.slice(0, 5));
        done();
      }));

      transport.levels = testLevels;
      expected.forEach(transport.write.bind(transport));
    });

    it('{ level } should be ignored when { handleExceptions: true }', function () {
      const expected = testOrder.map(levelAndMessage)
        .map(function (info) {
          info.exception = true;
          return info;
        });

      const transport = new LegacyTransportStream({
        transport: legacy,
        level: 'info'
      });

      legacy.on('logged', logFor(testOrder.length, function (err, infos) {
        assume(infos.length).equals(expected.length);
        assume(infos).deep.equals(expected);
        done();
      }));

      transport.levels = testLevels;
      expected.forEach(transport.write.bind(transport));
    });

    describe('when { exception: true } in info', function () {
      it('should not invoke log when { handleExceptions: false }', function (done) {
        const expected = [
          { exception: true, 'message': 'Test exception handling' },
          { [LEVEL]: 'test', level: 'test', message: 'Testing ... 1 2 3.' }
        ];

        legacy.on('logged', function (info) {
          assume(info.exception).equals(undefined);
          done();
        });

        expected.forEach(transport.write.bind(transport));
      });

      it('should invoke log when { handleExceptions: true }', function (done) {
        const actual = [];
        const expected = [
          { exception: true, [LEVEL]: 'error', level: 'error', message: 'Test exception handling' },
          { [LEVEL]: 'test', level: 'test', message: 'Testing ... 1 2 3.' }
        ];

        transport = new LegacyTransportStream({
          handleExceptions: true,
          transport: legacy
        });

        legacy.on('logged', function (info) {
          actual.push(info);
          if (actual.length === expected.length) {
            assume(actual).deep.equals(expected);
            done();
          }
        });

        expected.forEach(transport.write.bind(transport));
      });
    });
  });

  describe('_writev(chunks, callback)', function () {
    it('should be called when necessary in streams plumbing', function (done) {
      const expected = infosFor({ count: 50, levels: testOrder });

      legacy.on('logged', logFor(50 * testOrder.length, function (err, infos) {
        assume(infos.length).equals(expected.length);
        assume(infos).deep.equals(expected);
        done();
      }));

      //
      // Make the standard _write throw to ensure that _writev is called.
      //
      transport._write = function () {
        throw new Error('This should never be called');
      };

      transport.cork();
      expected.forEach(transport.write.bind(transport));
      transport.uncork();
    });
  });

  describe('close()', function () {
    it('removes __winstonError from the transport', function () {
      assume(legacy.__winstonError).is.a('function');
      assume(legacy.listenerCount('error')).equal(1);

      transport.close();
      assume(legacy.__winstonError).falsy();
      assume(legacy.listenerCount('error')).equal(0);
    });

    it('invokes .close() on the transport', function (done) {
      legacy.on('closed:custom', done());
      transport.close();
    });
  });

  //
  // Restore the deprecation notice after tests complete.
  //
  after(function () {
    deprecated.restore();
  });
});
