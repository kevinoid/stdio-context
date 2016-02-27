/**
 * @copyright Copyright 2016 Kevin Locke <kevin@kevinlocke.name>
 * @license MIT
 */
'use strict';

var inherits = require('util').inherits;
var stream = require('stream');

/** Constructs a Readable stream which contains no data.
 *
 * @constructor
 * @extends {stream.Readable}
 * @private
 */
function EmptyStream() {
  stream.Readable.call(this);
}
inherits(EmptyStream, stream.Readable);

/** @inheritDoc */
EmptyStream.prototype._read = function emptyRead() {
  this.push(null);
};

module.exports = EmptyStream;
