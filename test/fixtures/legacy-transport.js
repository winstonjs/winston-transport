'use strict';

const Transport = require('winston-compat').Transport;
const util = require('util');

/**
 * !!! HERE BE DRAGONS !!!
 *
 * Constructor function for the LegacyTransport which we use for
 * testing purposes. It breaks all the established rules and
 * conventions for testing edge cases. You SHOULD NOT use this
 * as an example for how to write a custom `winston` Transport.
 *
 * @param  {Object} opts Configuration for this instance
 */
const LegacyTransport = module.exports = function (opts) {
  opts = opts || {};

  Transport.call(this, opts);

  //
  // Remark: we literally accept levels for TESTING PURPOSES only.
  // In `winston` these levels will always inherit from the Logger
  // we are piped to.
  //
  this.levels = opts.levels;
  this.stream = opts.stream || { write: function () {} };
  this.streams = opts.streams;
};

//
// Define the name of the legacy Transport
//
LegacyTransport.prototype.name = 'TestLegacy';

//
// Inherit from the winston@2 transport exposed forever through
// `winston-compat`.
//
util.inherits(LegacyTransport, Transport);

/**
 * Writes to one of the streams associated with this instance.
 *
 * @param  {String} level Log level that the message and meta are associated with.
 * @param  {String} message Log message used to describe meta.
 * @param  {Object} meta Additional log metadata to persist with { level, message }.
 * @param  {Function} callback Continuation to respond to when complete
 */
LegacyTransport.prototype.log = function (level, message, meta, callback) {
  const info = Object.assign({}, meta, { level, message });
  const stream = (this.streams && this.streams[info.level]) || this.stream;
  stream.write(JSON.stringify(info));
  this.emit('logged', info);
  callback();
};

/**
 * Emits a custom close event for the purposes of testing
 */
LegacyTransport.prototype.close = function () {
  var self = this;
  setImmediate(function () {
    self.emit('closed:custom');
  });
};
