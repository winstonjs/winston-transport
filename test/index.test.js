
const assume = require('assume');
const stream = require('stream');
const TransportStream = require('../');
const SimpleTransport = require('./fixtures/simple-transport');

//
// Returns a function which logs a specified amount
// of times before calling the provided callback
//
function logFor(count, done) {
  const infos = [];
  return function log(info, next) {
    infos.push(info);
    next();
    if (!--count) { return done && done(null, infos); }
    if (count < 0) {
      throw new Error('Invoked more log messages than requested');
    }
  };
}

//
// Helper function for generating a set of messages
// one per level.
//
function levelAndMessage (level) {
  return {
    message: `Testing message for level: ${level}`,
    level
  };
}

//
// Inspects two arrays
//
function inspectLoggedResults(actual, expected) {
  const len = actual.length > expected.length
    ? actual.length
    : expected.length;

  console.log(`Length: { actual: ${actual.length}, expected: ${expected.length}`);

  for (let i = 0; i < len; i++) {
    if (actual[i] || expected[i]) {
      console.log(`actual[${i}]: %j`, actual[i]);
      console.log(`expected[${i}]: %j`, expected[i]);
    }
  }
}

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

  describe('{ exception: true }', function () {
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

    const testLevels = testOrder.reduce(function (acc, level, i) {
      acc[level] = i;
      return acc;
    }, {});

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
    it('should define { level, levels } on "pipe"');
  });
});
