'use strict';

var stream = require('stream'),
    util = require('util');

/**
 * Constructor function for the TransportStream. This is the base prototype
 * that all `winston >= 3` transports should inherit from.
 *
 * @param  {Object} opts Options for this TransportStream instance
 *   @param {String} opts.level HIGHEST level according to RFC5424.
 *   @param {Boolean} opts.handleExceptions If true, info with { exception: true } will be written.
 *   @param {Function} opts.log Custom log function for simple Transport creation
 *   @param {Function} opts.close Called on "unpipe" from parent
 */
var TransportStream = module.exports = function TransportStream(opts) {
  stream.Writable.call(this, { objectMode: true });
  opts = opts || {};
  //
  // TODO (indexzero): What do we do with formats on TransportStream
  // instances? Should we do the same dance as in `winston.Logger`?
  //
  this.format = opts.format;
  this.level = opts.level;
  this.handleExceptions = opts.handleExceptions;
  this.log = this.log || opts.log;
  this.close = this.close || opts.close;

  var self = this;

  //
  // Get the levels from the source we are piped from.
  //
  this.once('pipe', function (logger) {
    //
    // Remark (indexzero): this bookkeeping can only support multiple
    // Logger parents with the same `levels`. This comes into play in
    // the `winston.Container` code in which `container.add` takes
    // a fully realized set of options with pre-constructed TransportStreams.
    //
    self.levels = logger.levels;
    self.level = self.level || logger.level;
    self.parent = logger;
  });

  //
  // If and/or when the transport is removed from this instance
  //
  this.once('unpipe', function (src) {
    //
    // Remark (indexzero): this bookkeeping can only support multiple
    // Logger parents with the same `levels`. This comes into play in
    // the `winston.Container` code in which `container.add` takes
    // a fully realized set of options with pre-constructed TransportStreams.
    //
    if (src === self.parent) {
      this.parent = null;
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
    return callback(null);
  }

  //
  // Remark: This has to be handled in the base transport now because we cannot
  // conditionally write to our pipe targets as stream.
  //
  if (!this.level || this.levels[this.level] >= this.levels[info.level]) {
    return this.log(info, callback);
  }

  return callback(null);
};
