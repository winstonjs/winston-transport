'use strict';

const TransportStream = require('./');
const { LEVEL } = require('triple-beam');

module.exports = class LegacyTransportStream extends TransportStream {
  /**
   * Constructor function for the LegacyTransportStream. This is an internal
   * wrapper `winston >= 3` uses to wrap older transports implementing
   * log(level, message, meta).
   * @param {Object} options - Options for this TransportStream instance.
   * @param {Transpot} options.transport - winston@2 or older Transport to wrap.
   */
  constructor(options = {}) {
    super(options);
    if (!options.transport || typeof options.transport.log !== 'function') {
      throw new Error('Invalid transport, must be an object with a log method.');
    }

    this.transport = options.transport;
    this.level = this.level || options.transport.level;
    this.handleExceptions = this.handleExceptions || options.transport.handleExceptions;

    // Display our deprecation notice.
    this._deprecated();

    // Properly bubble up errors from the transport to the
    // LegacyTransportStream instance, but only once no matter how many times
    // this transport is shared.
    function transportError(err) {
      this.emit('error', err, this.transport);
    }

    if (!this.transport.__winstonError) {
      this.transport.__winstonError = transportError.bind(this);
      this.transport.on('error', this.transport.__winstonError);
    }
  }


  /**
   * Writes the info object to our transport instance.
   * @param {mixed} info - TODO: add param description.
   * @param {mixed} enc - TODO: add param description.
   * @param {function} callback - TODO: add param description.
   * @returns {undefined}
   * @private
   */
  _write(info, enc, callback) {
    if (this.silent || (info.exception === true && !this.handleExceptions)) {
      return callback(null);
    }

    // Remark: This has to be handled in the base transport now because we
    // cannot conditionally write to our pipe targets as stream.
    if (!this.level || this.levels[this.level] >= this.levels[info[LEVEL]]) {
      this.transport.log(info[LEVEL], info.message, info, this._nop);
    }

    callback(null);
  }

  /**
   * Writes the batch of info objects (i.e. "object chunks") to our transport
   * instance after performing any necessary filtering.
   * @param {mixed} chunks - TODO: add params description.
   * @param {function} callback - TODO: add params description.
   * @returns {mixed} - TODO: add returns description.
   * @private
   */
  _writev(chunks, callback) {
    for (let i = 0; i < chunks.length; i++) {
      if (this._accept(chunks[i])) {
        this.transport.log(
          chunks[i].chunk[LEVEL],
          chunks[i].chunk.message,
          chunks[i].chunk,
          this._nop
        );
        chunks[i].callback();
      }
    }

    return callback(null);
  }

  /**
   * Displays a deprecation notice. Defined as a function so it can be
   * overriden in tests.
   * @returns {undefined}
   */
  _deprecated() {
    // eslint-disable-next-line no-console
    console.error([
      `${this.transport.name} is a legacy winston transport. Consider upgrading: `,
      '- Upgrade docs: https://github.com/winstonjs/winston/blob/master/UPGRADE-3.0.md'
    ].join('\n'));
  }

  /**
   * Clean up error handling state on the legacy transport associated
   * with this instance.
   * @returns {undefined}
   */
  close() {
    if (this.transport.close) {
      this.transport.close();
    }

    if (this.transport.__winstonError) {
      this.transport.removeListener('error', this.transport.__winstonError);
      this.transport.__winstonError = null;
    }
  }
};
