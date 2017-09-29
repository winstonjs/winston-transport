'use strict';

const util = require('util');
const TransportStream = require('./');
const LEVEL = Symbol.for('level');

/**
 * Constructor function for the LegacyTransportStream. This is an internal wrapper
 * `winston >= 3` uses to wrap older transports implementing log(level, message, meta).
 *
 * @param  {Object} opts Options for this TransportStream instance.
 *   @param {Transpot} opts.transport winston@2 or older Transport to wrap.
 */
var LegacyTransportStream = module.exports = function LegacyTransportStream(opts) {
  opts = opts || {};
  if (!opts.transport || typeof opts.transport.log !== 'function') {
    throw new Error('Invalid transport, must be an object with a log method.');
  }

  TransportStream.call(this, opts);

  var self = this;
  this.transport = opts.transport;
  this.level = this.level || opts.transport.level;
  this.handleExceptions = this.handleExceptions || opts.transport.handleExceptions;

  // Display our deprecation notice.
  this._deprecated();

  //
  // Properly bubble up errors from the transport to the LegacyTransportStream
  // instance, but only once no matter how many times this transport is shared.
  //
  function transportError(err) {
    self.emit('error', err, self.transport);
  }

  if (!this.transport.__winstonError) {
    this.transport.__winstonError = transportError;
    this.transport.on('error', this.transport.__winstonError);
  }
};

util.inherits(LegacyTransportStream, TransportStream);

/*
 * @private function _write(info)
 * Writes the info object to our transport instance.
 */
LegacyTransportStream.prototype._write = function (info, enc, callback) {
  if (info.exception === true && !this.handleExceptions) {
    return callback(null);
  }

  //
  // Remark: This has to be handled in the base transport now because we cannot
  // conditionally write to our pipe targets as stream.
  //
  if (!this.level || this.levels[this.level] >= this.levels[info[LEVEL]]) {
    this.transport.log(info[LEVEL], info.message, info, this._nop);
  }

  callback(null);
};

/*
 * @private function _writev(chunks, callback)
 * Writes the batch of info objects (i.e. "object chunks") to our transport instance
 * after performing any necessary filtering.
 */
LegacyTransportStream.prototype._writev = function (chunks, callback) {
  const infos = chunks.filter(this._accept, this);
  for (var i = 0; i < infos.length; i++) {
    this.transport.log(infos[i].chunk[LEVEL], infos[i].chunk.message, infos[i].chunk, this._nop);
    infos[i].callback();
  }

  return callback(null);
};

/**
 * Displays a deprecation notice. Defined as a function so it can be overriden in tests.
 */
LegacyTransportStream.prototype._deprecated = function () {
  console.error([
    `${this.transport.name} is a legacy winston transport. Consider upgrading: `,
    '- Upgrade docs: https://github.com/winstonjs/winston/tree/master/UPGRADE.md'
  ].join('\n'));
};

/*
 * Clean up error handling state on the legacy transport associated
 * with this instance.
 */
LegacyTransportStream.prototype.close = function () {
  if (this.transport.close) {
    this.transport.close();
  }

  if (this.transport.__winstonError) {
    this.transport.removeListener('error', this.transport.__winstonError);
    this.transport.__winstonError = null;
  }
};
