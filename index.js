'use strict';

const stream = require('stream');
const util = require('util');
const LEVEL = Symbol.for('level');

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

  this.format = opts.format;
  this.level = opts.level;
  this.handleExceptions = opts.handleExceptions;

  if (opts.log) this.log = opts.log;
  if (opts.logv) this.logv = opts.logv;
  if (opts.close) this.close = opts.close;

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
  if (info.exception === true && !this.handleExceptions) {
    return callback(null);
  }

  //
  // Remark: This has to be handled in the base transport now because we cannot
  // conditionally write to our pipe targets as stream.
  //
  if (!this.level || this.levels[this.level] >= this.levels[info[LEVEL]]) {
    if (this.format) {
      return this.log(
        this.format.transform(Object.assign({}, info), this.format.options),
        callback
      );
    }

    return this.log(info, callback);
  }

  return callback(null);
};

/*
 * @private function _writev(chunks, callback)
 * Writes the batch of info objects (i.e. "object chunks") to our transport instance
 * after performing any necessary filtering.
 */
TransportStream.prototype._writev = function (chunks, callback) {
  const infos = chunks.filter(this._accept, this);
  if (this.logv) {
    return this.logv(infos, callback);
  }

  for (var i = 0; i < infos.length; i++) {
    this.log(infos[i].chunk, infos[i].callback);
  }

  return callback(null);
};

/**
 * Predicate function that returns true if the specfied `info` on the WriteReq, `write`, should
 * be passed down into the derived TransportStream's I/O via `.log(info, callback)`.
 * @param   {WriteReq} write winston@3 Node.js WriteReq for the `info` object representing the log message.
 * @returns {Boolean} Value indicating if the `write` should be accepted & logged.
 */
TransportStream.prototype._accept = function (write) {
  const info = write.chunk;

  //
  // Immediately check the average case: log level filtering.
  //
  if (info.exception === true || !this.level || this.levels[this.level] >= this.levels[info[LEVEL]]) {
    //
    // Ensure the info object is valid based on `{ exception }`:
    // 1. { handleExceptions: true }: all `info` objects are valid
    // 2. { exception: false }: accepted by all transports.
    //
    if (this.handleExceptions || info.exception !== true) {
      return true;
    }
  }

  return false;
};

/**
 * _nop is short for "No operation"
 * @return {Boolean} Intentionally false.
 */
TransportStream.prototype._nop = function () {
  return void undefined;
};
