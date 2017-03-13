'use strict';

var stream = require('stream'),
    util = require('util');

var TransportStream = module.exports = function TransportStream(opts) {
  stream.Writable.call(this, { objectMode: true });
  opts = opts || {};
  this.format = opts.format;
  this.level = opts.level;
  this.handleExceptions = opts.handleExceptions;
  this.log = this.log || opts.log;

  var self = this;

  //
  // Get the levels from the source we are piped from.
  //
  this.once('pipe', function (logger) {
    self.levels = logger.levels;
    self.level = self.level || logger.level;
    //
    // TODO: Improve bookkeeping here to support pipe and unpipe
    // from multiple LogStream parents (e.g. Containers)
    //
    self.parent = logger;
  });

  //
  // If and/or when the transport is removed from this instance
  //
  this.once('unpipe', function (src) {
    //
    // TODO: Improve bookkeeping here to support pipe and unpipe
    // from multiple LogStream parents (e.g. Containers)
    //
    if (src === self.parent) {
      //
      // Remark: this may not be the desired implementation since
      // a single transport may be shared by multiple Logger
      // instances.
      //
      if (self.close) {
        self.close();
      }
    }
  });
};

util.inherits(TransportStream, stream.Writable);

/*
 * @private function _write(info)
 * Writes the info object to our transport instance.
 */
TransportStream.prototype._write = function (info, enc, callback) {
  if (info.exception && !this.handleExceptions) {
    callback();
    return true;
  }

  //
  // Remark: This has to be handled in the base transport now because we cannot
  // conditionally write to our pipe targets as stream.
  //
  if (!this.level || this.levels[this.level] >= this.levels[info.level]) {
    return this.log(info, callback);
  }

  callback();
  return true;
};
