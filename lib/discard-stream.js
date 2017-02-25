/**
 * @copyright Copyright 2016 Kevin Locke <kevin@kevinlocke.name>
 * @license MIT
 */

'use strict';

var inherits = require('util').inherits;
var stream = require('stream');

/** Constructs a Writable stream which discards all data written to it.
 *
 * This is similar to a PassThrough stream in flowing mode, with the important
 * differences being that it is faster, it can't be read from, and it never
 * buffers.
 * @constructor
 * @extends {stream.Writable}
 * @private
 */
function DiscardStream() {
  // objectMode avoids doing any encoding/decoding of writes
  stream.Writable.call(this, {objectMode: true});
}
inherits(DiscardStream, stream.Writable);

/** @inheritDoc */
DiscardStream.prototype._write = function discardWrite(chunk, encoding,
  callback) {
  callback();
};

module.exports = DiscardStream;
