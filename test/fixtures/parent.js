'use strict';

const stream = require('stream');
const util = require('util');

/**
 * !!! HERE BE DRAGONS !!!
 *
 * Constructor function for the Parent which we use to represent
 * `winston.Logger` for testing purposes. You SHOULD NOT use this
 * as an example for ANYTHING.
 *
 * @param  {Object} opts Configuration for this instance
 */
const Parent = module.exports = function (opts) {
  stream.Transform.call(this, { objectMode: true });

  this.levels = opts.levels;
  this.level = opts.level;
};

util.inherits(Parent, stream.Transform);

/**
 * Basic pass-through write. In `winston` itself this writes to the `_format`
 * which itself is then read back and pushed.
 *
 * @param  {Info} info Winston log information
 * @param  {Function} callback Continuation to respond to when complete
 */
Parent.prototype._transform = function (info, enc, callback) {
  this.push(info);
  callback();
};
