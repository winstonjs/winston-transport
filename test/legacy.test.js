'use strict';

const assume = require('assume');
const stream = require('stream');
const LegacyTransportStream = require('../legacy');
const Parent = require('./fixtures/parent');
const LegacyTransport = require('./fixtures/legacy-transport');
const { logFor, levelAndMessage } = require('abstract-winston-transport/utils');

describe('LegacyTransportStream', function () {
  it('should have the appropriate methods defined', function () {
    const legacy = new LegacyTransport();
    const transport = new LegacyTransportStream({ transport: legacy });
    assume(transport).instanceof(stream.Writable);
    assume(transport._write).is.a('function');
    assume(transport.log).equals(undefined);
  });

  it('should error with no transport', function () {
    assume(function () {
      const transport = new LegacyTransportStream();
      assume(transport).instanceof(stream.Writable);
    }).throws(/Invalid transport, must be an object with a log method./);
  });

  it('should error with invalid transport', function () {
    assume(function () {
      const transport = new LegacyTransportStream();
      assume(transport).instanceof(stream.Writable);
    }).throws(/Invalid transport, must be an object with a log method./);
  });


});
