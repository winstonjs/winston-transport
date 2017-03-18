'use strict';

var util = require('util'),
    TransportStream = require('./');

var LegacyTransportStream = module.exports = function LegacyTransportStream(opts) {
  opts = opts || {};
  opts.objectMode = true;

  TransportStream.call(this, opts);

  var self = this;
  this.transport = opts.transport;
  this.level = opts.transport.level;

  if (typeof opts.transport.log !== 'function') {
    throw new Error('Invalid transport, must be an object with a log method.');
  }

  console.error('%s is a Legacy winston transport. Consider upgrading', opts.transport.name);

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
  //
  // Remark: This has to be handled in the base transport now because we cannot
  // conditionally write to our pipe targets as stream.
  //
  if (!this.level || this.levels[this.level] >= this.levels[info.level]) {
    this.transport.log(info.level, info.message, info, function () {});
  }

  callback(null);
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
  }
};
