StdioContext
============

[![Build Status: Linux](https://img.shields.io/travis/kevinoid/stdio-context/master.svg?style=flat&label=build+on+linux)](https://travis-ci.org/kevinoid/stdio-context)
[![Build Status: Windows](https://img.shields.io/appveyor/ci/kevinoid/stdio-context/master.svg?style=flat&label=build+on+windows)](https://ci.appveyor.com/project/kevinoid/stdio-context)
[![Coverage](https://img.shields.io/codecov/c/github/kevinoid/stdio-context.svg?style=flat)](https://codecov.io/github/kevinoid/stdio-context?branch=master)
[![Dependency Status](https://img.shields.io/david/kevinoid/stdio-context.svg?style=flat)](https://david-dm.org/kevinoid/stdio-context)
[![Supported Node Version](https://img.shields.io/node/v/stdio-context.svg?style=flat)](https://www.npmjs.com/package/stdio-context)
[![Version on NPM](https://img.shields.io/npm/v/stdio-context.svg?style=flat)](https://www.npmjs.com/package/stdio-context)

A Node.js library to replace `stdin`, `stdout`, and/or `stderr`, including `console` methods, with arbitrary streams in a controlled way for capture, redirection, testing, or other purposes.

## !!! Unmaintained Project !!!

This project is currently outdated and unmaintained.  Depending on this
project is not recommended.  If you have an interest in maintaining this
project, or a compelling use case to justify continued maintenance by the
original maintainer, feel free to [open an
issue](https://github.com/kevinoid/stdio-context/issues).

## Introductory Example

```js
var StdioContext = require('stdio-context');
var assert = require('assert');
var stream = require('stream');

var myStdin = new stream.PassThrough({objectMode: true});
var myStdout = new stream.PassThrough({objectMode: true});
var myStderr = new stream.PassThrough({objectMode: true});

var myStdioContext = new StdioContext({
  stdin: myStdin,
  stdout: myStdout,
  stderr: myStderr
});

function doStdioStuff() {
  myStdin.write('in stuff');
  assert.strictEqual(process.stdin.read(), 'in stuff');
  process.stdout.write('out stuff');
  assert.strictEqual(myStdout.read(), 'out stuff');
  process.stderr.write('err stuff');
  assert.strictEqual(myStderr.read(), 'err stuff');
  console.log('console.log stuff');
  assert.strictEqual(myStdout.read(), 'console.log stuff\n');
  console.error('console.error stuff');
  assert.strictEqual(myStderr.read(), 'console.error stuff\n');
}

var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
wrappedStdioStuff();
```

## Features

* Supports replacing (monkey patching) `process.stdin`, `process.stdout`, and
  `process.stderr` in a controlled and scope-limited way that is
  exception-safe.
* Replaces the global `console` object as necessary to capture output written
  via `console`.
* Uses plain Node streams, allowing redirection to files, sockets,
  compression, encryption, or any other behavior exposing a stream interface.
* Supports wrapping synchronous and asynchronous functions returning
  <code>Promise</code> or accepting a callback function.
* Supports discarding input and/or output without encoding or buffering.
* Checks for changes to stdio streams by other code and can either overwrite,
  throw, or preserve the changes (based on constructor options).
* Contexts can be nested and are reentrant, allowing overlapping use by
  multiple libraries without conflict.

## Installation

[This package](https://www.npmjs.com/package/stdio-context) can be
installed using [npm](https://www.npmjs.com/), either globally or locally, by
running:

```sh
npm install stdio-context
```

## Recipes

### Redirect stdio to/from files.

```js
var StdioContext = require('stdio-context');
var fs = require('fs');

var inStream = fs.createReadStream('input.txt', {encoding: 'utf8'});
var outStream = fs.createReadStream('output.txt');

var myStdioContext = new StdioContext({
  stdin: inStream,
  stdout: outStream,
  stderr: outStream
});

function doStdioStuff() {
  process.stdin.read();         // content from input.txt
  console.log('out stuff');     // content sent to output.txt
  console.error('err stuff');   // content also sent to output.txt
}

myStdioContext.exec(doStdioStuff);
```

### Discard input and/or output

```js
var StdioContext = require('stdio-context');
var assert = require('assert');

var myStdioContext = new StdioContext({
  stdin: null,
  stdout: null
});

function doStdioStuff() {
  assert.strictEqual(process.stdin.read(), null);
  console.log('out stuff');         // discarded without error
  console.error('Look at me!');     // sent to original process.stderr
}

myStdioContext.exec(doStdioStuff);
```

### Redirect for asynchronous function

```js
var StdioContext = require('stdio-context');
var fs = require('fs');

var inStream = fs.createReadStream('input.txt', {encoding: 'utf8'});
var outStream = fs.createReadStream('output.txt');

var myStdioContext = new StdioContext({
  stdin: inStream,
  stdout: outStream,
  stderr: outStream
});

function doStdioStuff(cb) {
  // Resolving the Promise or calling the callback exits the context
  return new Promise(function(resolve, reject) {
    process.nextTick(function() {
      process.stdin.read();         // content still from input.txt
      console.log('out stuff');     // content still sent to output.txt
      console.error('err stuff');   // content also sent to output.txt

      // Either of these would exit the context
      cb();
      resolve();
    });
  });
}

var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);

function callback() {}
function onThen() {}
wrappedStdioStuff(callback).then(onThen);
```

More examples can be found in the [test
specifications](https://kevinoid.github.io/stdio-context/spec).

## API Docs

For a description of the available types, methods, and their arguments, see
the [API Documentation](https://kevinoid.github.io/stdio-context/api).

## Similar Packages

If this package does not fit your needs, you may be interested in similar
packages:

* [console-monkey-patch](https://github.com/NetOxygen/console-monkey-patch) -
  Replaces the methods of `console` with functions provided by the caller.
* [console-redirect](https://github.com/mattdesl/console-redirect) - Replaces
  the methods of `console` to write to caller-provided streams (and optionally
  the `process` streams).
* [hook-std](https://github.com/sindresorhus/hook-std) - Replaces the `.write`
  method of `stdout` and/or `stderr` with a user-provided function.
* [loghooks-node](https://github.com/digplan/loghooks-node) - Replaces the
  `.write` method of `stdout`/`stderr` with a user-provided function and
  provides convenience functions for writing to file or socket.
* [stdout-monkey](https://github.com/stringparser/stdout-monkey) - Replaces or
  observes the `.write` method of `stdout`.

## Contributing

Contributions are welcome and very much appreciated!  Please add tests to
cover any changes and ensure `npm test` passes.

If the desired change is large, complex, backwards-incompatible, can have
significantly differing implementations, or may not be in scope for this
project, opening an issue before writing the code can avoid frustration and
save a lot of time and effort.

## License

This package is available under the terms of the
[MIT License](https://opensource.org/licenses/MIT).
