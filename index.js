'use strict';

const util = require('util');
const Writable = require('readable-stream/writable');
const { LEVEL } = require('triple-beam');

/**
 * Constructor function for the TransportStream. This is the base prototype
 * that all `winston >= 3` transports should inherit from.
 * @param {Object} options - Options for this TransportStream instance
 * @param {String} options.level - Highest level according to RFC5424.
 * @param {Boolean} options.handleExceptions - If true, info with
 * { exception: true } will be written.
 * @param {Function} options.log - Custom log function for simple Transport
 * creation
 * @param {Function} options.close - Called on "unpipe" from parent.
 */
const TransportStream = module.exports = function TransportStream(options = {}) {
  Writable.call(this, { objectMode: true, highWaterMark: options.highWaterMark });

  this.format = options.format;
  this.level = options.level;
  this.handleExceptions = options.handleExceptions;
  this.handleRejections = options.handleRejections;
  this.silent = options.silent;

  if (options.log) this.log = options.log;
  if (options.logv) this.logv = options.logv;
  if (options.close) this.close = options.close;

  // Get the levels from the source we are piped from.
  this.once('pipe', logger => {
    // Remark (indexzero): this bookkeeping can only support multiple
    // Logger parents with the same `levels`. This comes into play in
    // the `winston.Container` code in which `container.add` takes
    // a fully realized set of options with pre-constructed TransportStreams.
    this.levels = logger.levels;
    this.parent = logger;
  });

  // If and/or when the transport is removed from this instance
  this.once('unpipe', src => {
    // Remark (indexzero): this bookkeeping can only support multiple
    // Logger parents with the same `levels`. This comes into play in
    // the `winston.Container` code in which `container.add` takes
    // a fully realized set of options with pre-constructed TransportStreams.
    if (src === this.parent) {
      this.parent = null;
      if (this.close) {
        this.close();
      }
    }
  });
};

/*
 * Inherit from Writeable using Node.js built-ins
 */
util.inherits(TransportStream, Writable);

/**
 * Writes the info object to our transport instance.
 * @param {mixed} info - TODO: add param description.
 * @param {mixed} enc - TODO: add param description.
 * @param {function} callback - TODO: add param description.
 * @returns {undefined}
 * @private
 */
TransportStream.prototype._write = function _write(info, enc, callback) {
  if (this.silent || (info.exception === true && !this.handleExceptions)) {
    return callback(null);
  }

  // Remark: This has to be handled in the base transport now because we
  // cannot conditionally write to our pipe targets as stream. We always
  // prefer any explicit level set on the Transport itself falling back to
  // any level set on the parent.
  const level = this.level || (this.parent && this.parent.level);

  if (info.exception === true || !level || this.levels[level] >= this.levels[info[LEVEL]]) {
    if (info && !this.format) {
      return this.log(info, callback);
    }

    let errState;
    let transformed;

    // We trap(and re-throw) any errors generated by the user-provided format, but also
    // guarantee that the streams callback is invoked so that we can continue flowing.
    try {
      transformed = this.format.transform(Object.assign({}, info), this.format.options);
    } catch (err) {
      errState = err;
    }

    if (errState || !transformed) {
      // eslint-disable-next-line callback-return
      callback();
      if (errState) throw errState;
      return;
    }

    return this.log(transformed, callback);
  }

  return callback(null);
};

/**
 * Writes the batch of info objects (i.e. "object chunks") to our transport
 * instance after performing any necessary filtering.
 * @param {mixed} chunks - TODO: add params description.
 * @param {function} callback - TODO: add params description.
 * @returns {mixed} - TODO: add returns description.
 * @private
 */
TransportStream.prototype._writev = function _writev(chunks, callback) {
  if (this.logv) {
    const infos = chunks.filter(this._accept, this);
    if (!infos.length) {
      return callback(null);
    }

    // Remark (indexzero): from a performance perspective if Transport
    // implementers do choose to implement logv should we make it their
    // responsibility to invoke their format?
    return this.logv(infos, callback);
  }

  for (let i = 0; i < chunks.length; i++) {
    if (!this._accept(chunks[i])) continue;

    if (chunks[i].chunk && !this.format) {
      this.log(chunks[i].chunk, chunks[i].callback);
      continue;
    }

    let errState;
    let transformed;

    // We trap(and re-throw) any errors generated by the user-provided format, but also
    // guarantee that the streams callback is invoked so that we can continue flowing.
    try {
      transformed = this.format.transform(
        Object.assign({}, chunks[i].chunk),
        this.format.options
      );
    } catch (err) {
      errState = err;
    }

    if (errState || !transformed) {
      // eslint-disable-next-line callback-return
      chunks[i].callback();
      if (errState) {
        // eslint-disable-next-line callback-return
        callback(null);
        throw errState;
      }
    } else {
      this.log(transformed, chunks[i].callback);
    }
  }

  return callback(null);
};

/**
 * Predicate function that returns true if the specfied `info` on the
 * WriteReq, `write`, should be passed down into the derived
 * TransportStream's I/O via `.log(info, callback)`.
 * @param {WriteReq} write - winston@3 Node.js WriteReq for the `info` object
 * representing the log message.
 * @returns {Boolean} - Value indicating if the `write` should be accepted &
 * logged.
 */
TransportStream.prototype._accept = function _accept(write) {
  const info = write.chunk;
  if (this.silent) {
    return false;
  }

  // We always prefer any explicit level set on the Transport itself
  // falling back to any level set on the parent.
  const level = this.level || (this.parent && this.parent.level);

  // Immediately check the average case: log level filtering.
  if (
    info.exception === true ||
    !level ||
    this.levels[level] >= this.levels[info[LEVEL]]
  ) {
    // Ensure the info object is valid based on `{ exception }`:
    // 1. { handleExceptions: true }: all `info` objects are valid
    // 2. { exception: false }: accepted by all transports.
    if (this.handleExceptions || info.exception !== true) {
      return true;
    }
  }

  return false;
};

/**
 * _nop is short for "No operation"
 * @returns {Boolean} Intentionally false.
 */
TransportStream.prototype._nop = function _nop() {
  // eslint-disable-next-line no-undefined
  return void undefined;
};


// Expose legacy stream
module.exports.LegacyTransportStream = require('./legacy');
