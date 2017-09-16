/**
 * @copyright Copyright 2016 Kevin Locke <kevin@kevinlocke.name>
 * @license MIT
 */

'use strict';

// We test the console a lot.  Allow access without warning.
/* eslint-disable no-console */

var BBPromise = require('bluebird').Promise;
var StdioContext = require('..');
var assert = require('assert');
var stream = require('stream');

var Promise = global.Promise || BBPromise; // eslint-disable-line no-shadow
var deepEqual = assert.deepStrictEqual || assert.deepEqual;

/* Developer Note:
 * The tests are organized in a reasonable reading order such that someone
 * being introduced to the library could read through the tests to learn what
 * it does.  They are roughly grouped and assume knowledge of earlier tests.
 */

describe('StdioContext', function() {
  var beforeConsoleDesc = Object.getOwnPropertyDescriptor(global, 'console');
  var beforeStdinDesc = Object.getOwnPropertyDescriptor(process, 'stdin');
  var beforeStdoutDesc = Object.getOwnPropertyDescriptor(process, 'stdout');
  var beforeStderrDesc = Object.getOwnPropertyDescriptor(process, 'stderr');
  var beforeConsole = global.console;
  var beforeStdin = process.stdin;
  var beforeStdout = process.stdout;
  var beforeStderr = process.stderr;
  function restoreStdio() {
    try {
      assert.strictEqual(global.console, beforeConsole);
      assert.strictEqual(process.stdin, beforeStdin);
      assert.strictEqual(process.stdout, beforeStdout);
      assert.strictEqual(process.stderr, beforeStderr);
    } finally {
      Object.defineProperty(global, 'console', beforeConsoleDesc);
      Object.defineProperty(process, 'stdin', beforeStdinDesc);
      Object.defineProperty(process, 'stdout', beforeStdoutDesc);
      Object.defineProperty(process, 'stderr', beforeStderrDesc);
    }
  }
  afterEach(restoreStdio);

  describe('#wrap()', function() {
    it('replaces stdio streams for a wrapped function', function() {
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
    });

    it('passes this, arguments, and return value', function() {
      var myStdioContext = new StdioContext({
        stdin: new stream.PassThrough(),
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      var stuffThis = {};
      var stuffArgs = [undefined, {}];
      var stuffRetVal = {};
      function doStdioStuff() {
        assert.strictEqual(this, stuffThis);
        deepEqual(Array.prototype.slice.call(arguments), stuffArgs);
        return stuffRetVal;
      }

      var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
      var wrappedRetVal = wrappedStdioStuff.apply(stuffThis, stuffArgs);
      assert.strictEqual(wrappedRetVal, stuffRetVal);
    });

    it('passes callback this, arguments, and return value', function(done) {
      var myStdioContext = new StdioContext({
        stdin: new stream.PassThrough(),
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      var stuffCbThis = {};
      var stuffCbArgs = [undefined, {}];
      var stuffCbRetVal = {};
      function doAsyncStdioStuff(callback) {
        process.nextTick(function() {
          var wrappedCbRetVal = callback.apply(stuffCbThis, stuffCbArgs);
          assert.strictEqual(wrappedCbRetVal, stuffCbRetVal);
          done();
        });
      }

      function stuffCb() {
        assert.strictEqual(this, stuffCbThis);
        deepEqual(Array.prototype.slice.call(arguments), stuffCbArgs);
        return stuffCbRetVal;
      }

      var wrappedStdioStuff = myStdioContext.wrap(doAsyncStdioStuff);
      wrappedStdioStuff(stuffCb);
    });

    it('restores stdio streams on return from non-async function', function() {
      var origConsole = console;
      var origStdin = process.stdin;
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdioContext = new StdioContext({
        stdin: new stream.PassThrough(),
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      function doStdioStuff() {}

      var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
      wrappedStdioStuff();

      assert.strictEqual(console, origConsole);
      assert.strictEqual(process.stdin, origStdin);
      assert.strictEqual(process.stdout, origStdout);
      assert.strictEqual(process.stderr, origStderr);
    });

    it('restores stdio streams on exception from function', function() {
      var origConsole = console;
      var origStdin = process.stdin;
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdioContext = new StdioContext({
        stdin: new stream.PassThrough(),
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      var testErr = new Error('test');
      function doAsyncStdioStuff(callback) {
        throw testErr;
      }

      var wrappedStdioStuff = myStdioContext.wrap(doAsyncStdioStuff);

      assert.throws(
        wrappedStdioStuff,
        function(err) { return err === testErr; }
      );

      assert.strictEqual(console, origConsole);
      assert.strictEqual(process.stdin, origStdin);
      assert.strictEqual(process.stdout, origStdout);
      assert.strictEqual(process.stderr, origStderr);
    });

    it('restores stdio streams on callback', function(done) {
      var origConsole = console;
      var origStdin = process.stdin;
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdin = new stream.PassThrough({objectMode: true});
      var myStdout = new stream.PassThrough({objectMode: true});
      var myStderr = new stream.PassThrough({objectMode: true});

      var myStdioContext = new StdioContext({
        stdin: myStdin,
        stdout: myStdout,
        stderr: myStderr
      });

      function doAsyncStdioStuff(callback) {
        process.nextTick(callback);
      }

      function stuffCb() {
        assert.strictEqual(console, origConsole);
        assert.strictEqual(process.stdin, origStdin);
        assert.strictEqual(process.stdout, origStdout);
        assert.strictEqual(process.stderr, origStderr);
        done();
      }

      var wrappedStdioStuff = myStdioContext.wrap(doAsyncStdioStuff);
      wrappedStdioStuff(stuffCb);

      assert.notEqual(console, origConsole);
      assert.strictEqual(process.stdin, myStdin);
      assert.strictEqual(process.stdout, myStdout);
      assert.strictEqual(process.stderr, myStderr);
    });

    it('restores stdio streams on Promise resolution', function() {
      var origConsole = console;
      var origStdin = process.stdin;
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdin = new stream.PassThrough({objectMode: true});
      var myStdout = new stream.PassThrough({objectMode: true});
      var myStderr = new stream.PassThrough({objectMode: true});

      var myStdioContext = new StdioContext({
        stdin: myStdin,
        stdout: myStdout,
        stderr: myStderr
      });

      var stuffResolved = {};
      function doAsyncStdioStuff() {
        return new Promise(function(resolve, reject) {
          process.nextTick(function() {
            resolve(stuffResolved);
          });
        });
      }

      function thenStuff(wrappedResolved) {
        assert.strictEqual(wrappedResolved, stuffResolved);
        assert.strictEqual(console, origConsole);
        assert.strictEqual(process.stdin, origStdin);
        assert.strictEqual(process.stdout, origStdout);
        assert.strictEqual(process.stderr, origStderr);
      }

      var wrappedStdioStuff = myStdioContext.wrap(doAsyncStdioStuff);
      var promise = wrappedStdioStuff().then(thenStuff);

      assert.notEqual(console, origConsole);
      assert.strictEqual(process.stdin, myStdin);
      assert.strictEqual(process.stdout, myStdout);
      assert.strictEqual(process.stderr, myStderr);

      return promise;
    });

    it('restores stdio streams on Promise rejection', function() {
      var origConsole = console;
      var origStdin = process.stdin;
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdin = new stream.PassThrough({objectMode: true});
      var myStdout = new stream.PassThrough({objectMode: true});
      var myStderr = new stream.PassThrough({objectMode: true});

      var myStdioContext = new StdioContext({
        stdin: myStdin,
        stdout: myStdout,
        stderr: myStderr
      });

      var stuffCause = {};
      function doAsyncStdioStuff() {
        return new Promise(function(resolve, reject) {
          process.nextTick(function() {
            reject(stuffCause);
          });
        });
      }

      function throwIfThen() {
        throw new Error('Expected Promise to be rejected');
      }

      function catchStuff(wrappedCause) {
        assert.strictEqual(wrappedCause, stuffCause);
        assert.strictEqual(console, origConsole);
        assert.strictEqual(process.stdin, origStdin);
        assert.strictEqual(process.stdout, origStdout);
        assert.strictEqual(process.stderr, origStderr);
      }

      var wrappedStdioStuff = myStdioContext.wrap(doAsyncStdioStuff);
      var promise = wrappedStdioStuff().then(throwIfThen, catchStuff);

      assert.notEqual(console, origConsole);
      assert.strictEqual(process.stdin, myStdin);
      assert.strictEqual(process.stdout, myStdout);
      assert.strictEqual(process.stderr, myStderr);

      return promise;
    });

    it('restores stdio streams if both Promise and callback', function() {
      var origConsole = console;
      var origStdin = process.stdin;
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdin = new stream.PassThrough({objectMode: true});
      var myStdout = new stream.PassThrough({objectMode: true});
      var myStderr = new stream.PassThrough({objectMode: true});

      var myStdioContext = new StdioContext({
        stdin: myStdin,
        stdout: myStdout,
        stderr: myStderr,
        strict: true
      });

      function doAsyncStdioStuff(cb) {
        return new Promise(function(resolve, reject) {
          process.nextTick(function() {
            cb();
            resolve();
          });
        });
      }

      function thenStuff() {
        assert.strictEqual(console, origConsole);
        assert.strictEqual(process.stdin, origStdin);
        assert.strictEqual(process.stdout, origStdout);
        assert.strictEqual(process.stderr, origStderr);
      }

      var wrappedStdioStuff = myStdioContext.wrap(doAsyncStdioStuff);
      var promise = wrappedStdioStuff(function() {}).then(thenStuff);

      assert.notEqual(console, origConsole);
      assert.strictEqual(process.stdin, myStdin);
      assert.strictEqual(process.stdout, myStdout);
      assert.strictEqual(process.stderr, myStderr);

      return promise;
    });

    it('restores stdio streams if both exception and callback', function(done) {
      var origConsole = console;
      var origStdin = process.stdin;
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdin = new stream.PassThrough({objectMode: true});
      var myStdout = new stream.PassThrough({objectMode: true});
      var myStderr = new stream.PassThrough({objectMode: true});

      var myStdioContext = new StdioContext({
        stdin: myStdin,
        stdout: myStdout,
        stderr: myStderr,
        strict: true
      });

      var testErr = new Error('test');
      function doAsyncStdioStuff(callback) {
        process.nextTick(callback);
        throw testErr;
      }

      function cbStuff() {
        assert.strictEqual(console, origConsole);
        assert.strictEqual(process.stdin, origStdin);
        assert.strictEqual(process.stdout, origStdout);
        assert.strictEqual(process.stderr, origStderr);
        done();
      }

      var wrappedStdioStuff = myStdioContext.wrap(doAsyncStdioStuff);
      assert.throws(
        function() { wrappedStdioStuff(cbStuff); },
        function(err) { return err === testErr; }
      );

      assert.strictEqual(console, origConsole);
      assert.strictEqual(process.stdin, origStdin);
      assert.strictEqual(process.stdout, origStdout);
      assert.strictEqual(process.stderr, origStderr);
    });

    it('does not overwrite modified stdio streams by default', function() {
      var origStderr = process.stderr;

      var myStdioContext = new StdioContext({
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      var origStdoutDesc = Object.getOwnPropertyDescriptor(process, 'stdout');
      var modifiedStdout = new stream.PassThrough();

      function doStdioStuff() {
        Object.defineProperty(process, 'stdout', {value: modifiedStdout});
      }

      var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
      wrappedStdioStuff();

      assert.strictEqual(process.stdout, modifiedStdout);
      assert.strictEqual(process.stderr, origStderr);

      Object.defineProperty(process, 'stdout', origStdoutDesc);
    });

    it('can overwrite modified stdio streams', function() {
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdioContext = new StdioContext({
        overwrite: true,
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      var modifiedStdout = new stream.PassThrough();

      function doStdioStuff() {
        Object.defineProperty(process, 'stdout', {value: modifiedStdout});
      }

      var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
      wrappedStdioStuff();

      assert.strictEqual(process.stdout, origStdout);
      assert.strictEqual(process.stderr, origStderr);
    });

    it('can throw on modified stdio streams', function() {
      var myStderr = new stream.PassThrough();
      var myStdioContext = new StdioContext({
        stderr: myStderr,
        strict: true
      });

      var origConsoleDesc = Object.getOwnPropertyDescriptor(global, 'console');
      var origStderrDesc = Object.getOwnPropertyDescriptor(process, 'stderr');
      var modifiedStderr = new stream.PassThrough();

      function doStdioStuff() {
        Object.defineProperty(process, 'stderr', {value: modifiedStderr});
      }

      var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
      assert.throws(wrappedStdioStuff, /modified/i);

      assert.strictEqual(process.stderr, modifiedStderr);

      Object.defineProperty(global, 'console', origConsoleDesc);
      Object.defineProperty(process, 'stderr', origStderrDesc);
    });

    it('doesn\'t overwrite stdio streams not in context', function() {
      var origStderr = process.stderr;

      var myStdioContext = new StdioContext({
        overwrite: true,
        stderr: new stream.PassThrough(),
        strict: true
      });

      var origStdoutDesc = Object.getOwnPropertyDescriptor(process, 'stdout');
      var modifiedStdout = new stream.PassThrough();

      function doStdioStuff() {
        Object.defineProperty(process, 'stdout', {value: modifiedStdout});
      }

      var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
      wrappedStdioStuff();

      assert.strictEqual(process.stdout, modifiedStdout);
      assert.strictEqual(process.stderr, origStderr);

      Object.defineProperty(process, 'stdout', origStdoutDesc);
    });

    it('can be nested', function() {
      var myStdin1 = new stream.PassThrough({objectMode: true});
      var myStdout1 = new stream.PassThrough({objectMode: true});
      var myStderr1 = new stream.PassThrough({objectMode: true});
      var myStdioContext1 = new StdioContext({
        stdin: myStdin1,
        stdout: myStdout1,
        stderr: myStderr1
      });

      var myStdin2 = new stream.PassThrough({objectMode: true});
      var myStdout2 = new stream.PassThrough({objectMode: true});
      var myStderr2 = new stream.PassThrough({objectMode: true});
      var myStdioContext2 = new StdioContext({
        stdin: myStdin2,
        stdout: myStdout2,
        stderr: myStderr2
      });

      function doStdio2Stuff() {
        myStdin2.write('in2 stuff');
        assert.strictEqual(process.stdin.read(), 'in2 stuff');
        process.stdout.write('out stuff');
        assert.strictEqual(myStdout2.read(), 'out stuff');
        process.stderr.write('err stuff');
        assert.strictEqual(myStderr2.read(), 'err stuff');
        console.log('console.log stuff');
        assert.strictEqual(myStdout2.read(), 'console.log stuff\n');
        console.error('console.error stuff');
        assert.strictEqual(myStderr2.read(), 'console.error stuff\n');
      }

      function doStdio1Stuff() {
        myStdin1.write('in1 stuff');
        var wrappedStdio2Stuff = myStdioContext2.wrap(doStdio2Stuff);
        wrappedStdio2Stuff();
        assert.strictEqual(myStdin1.read(), 'in1 stuff');
        assert.strictEqual(myStdout1.read(), null);
        assert.strictEqual(myStderr1.read(), null);
      }

      var wrappedStdio1Stuff = myStdioContext1.wrap(doStdio1Stuff);
      wrappedStdio1Stuff();
    });

    it('can be directly nested with itself', function() {
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

      function doAndWrapStdioStuff() {
        var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
        wrappedStdioStuff();

        // Still wrapped after nested wrapped call returns
        process.stderr.write('err stuff');
        assert.strictEqual(myStderr.read(), 'err stuff');
      }

      var nestedStdioStuff = myStdioContext.wrap(doAndWrapStdioStuff);
      nestedStdioStuff();
    });

    it('can be indirectly nested with itself', function() {
      var myStdin1 = new stream.PassThrough({objectMode: true});
      var myStdout1 = new stream.PassThrough({objectMode: true});
      var myStderr1 = new stream.PassThrough({objectMode: true});
      var myStdioContext1 = new StdioContext({
        stdin: myStdin1,
        stdout: myStdout1,
        stderr: myStderr1,
        strict: true
      });

      var myStdin2 = new stream.PassThrough({objectMode: true});
      var myStdout2 = new stream.PassThrough({objectMode: true});
      var myStderr2 = new stream.PassThrough({objectMode: true});
      var myStdioContext2 = new StdioContext({
        stdin: myStdin2,
        stdout: myStdout2,
        stderr: myStderr2,
        strict: true
      });

      function secondStdio1Stuff() {
        myStdin1.write('in1 stuff');
        assert.strictEqual(process.stdin.read(), 'in1 stuff');
        process.stdout.write('out stuff');
        assert.strictEqual(myStdout1.read(), 'out stuff');
        process.stderr.write('err stuff');
        assert.strictEqual(myStderr1.read(), 'err stuff');
        console.log('console.log stuff');
        assert.strictEqual(myStdout1.read(), 'console.log stuff\n');
        console.error('console.error stuff');
        assert.strictEqual(myStderr1.read(), 'console.error stuff\n');
      }

      function doStdio2Stuff() {
        myStdin2.write('in2 stuff');
        var nestedStdio1Stuff = myStdioContext1.wrap(secondStdio1Stuff);
        nestedStdio1Stuff();
        assert.strictEqual(process.stdin.read(), 'in2 stuff');
        process.stdout.write('out stuff');
        assert.strictEqual(myStdout2.read(), 'out stuff');
        process.stderr.write('err stuff');
        assert.strictEqual(myStderr2.read(), 'err stuff');
        console.log('console.log stuff');
        assert.strictEqual(myStdout2.read(), 'console.log stuff\n');
        console.error('console.error stuff');
        assert.strictEqual(myStderr2.read(), 'console.error stuff\n');
      }

      function firstStdio1Stuff() {
        var wrappedStdio2Stuff = myStdioContext2.wrap(doStdio2Stuff);
        wrappedStdio2Stuff();
      }

      var wrappedStdio1Stuff = myStdioContext1.wrap(firstStdio1Stuff);
      wrappedStdio1Stuff();
    });

    it('discards streams which are set to null', function(done) {
      var myStdin1 = new stream.PassThrough({objectMode: true});
      var myStdout1 = new stream.PassThrough({objectMode: true});
      var myStderr1 = new stream.PassThrough({objectMode: true});
      var myStdioContext1 = new StdioContext({
        stdin: myStdin1,
        stdout: myStdout1,
        stderr: myStderr1
      });

      var myStdioContext2 = new StdioContext({
        stdin: null,
        stdout: null,
        stderr: null
      });

      function doStdio2Stuff() {
        // 'end' event will arrive on next tick
        process.stdin.on('end', done);
        assert.strictEqual(process.stdin.read(), null);

        // Recent versions of Node have a highWaterMark of 16 in objectMode
        // and 16 * 1024 in bytes.  PassThrough has 2 buffers.  Double it once
        // more to protect against increases in future versions.
        var numTestWrites = 64;
        // eslint-disable-next-line no-buffer-constructor
        var testContent = Buffer.alloc ? Buffer.alloc(1024) : new Buffer(1024);

        for (var i = 0; i < numTestWrites; i += 1) {
          assert.strictEqual(process.stdout.write(testContent), true);
        }
        assert.strictEqual(myStdout1.read(), null);

        for (var j = 0; j < numTestWrites; j += 1) {
          assert.strictEqual(process.stderr.write(testContent), true);
        }
        assert.strictEqual(myStderr1.read(), null);

        console.log('console.log stuff');
        assert.strictEqual(myStdout1.read(), null);

        console.error('console.error stuff');
        assert.strictEqual(myStderr1.read(), null);
      }

      function doStdio1Stuff() {
        myStdin1.write('in1 stuff');
        var wrappedStdio2Stuff = myStdioContext2.wrap(doStdio2Stuff);
        wrappedStdio2Stuff();
        assert.strictEqual(myStdin1.read(), 'in1 stuff');
        assert.strictEqual(myStdout1.read(), null);
        assert.strictEqual(myStderr1.read(), null);
      }

      var wrappedStdio1Stuff = myStdioContext1.wrap(doStdio1Stuff);
      wrappedStdio1Stuff();
    });

    it('ignores streams which are set to undefined', function() {
      var myStdin1 = new stream.PassThrough({objectMode: true});
      var myStdout1 = new stream.PassThrough({objectMode: true});
      var myStderr1 = new stream.PassThrough({objectMode: true});
      var myStdioContext1 = new StdioContext({
        stdin: myStdin1,
        stdout: myStdout1,
        stderr: myStderr1
      });

      var myStdioContext2 = new StdioContext({
        stdin: undefined,
        stdout: undefined,
        stderr: undefined
      });

      function doStdio2Stuff() {
        // Although we are in the 2 context, all streams are preserved from 1
        myStdin1.write('in1 stuff');
        assert.strictEqual(process.stdin.read(), 'in1 stuff');
        process.stdout.write('out stuff');
        assert.strictEqual(myStdout1.read(), 'out stuff');
        process.stderr.write('err stuff');
        assert.strictEqual(myStderr1.read(), 'err stuff');
        console.log('console.log stuff');
        assert.strictEqual(myStdout1.read(), 'console.log stuff\n');
        console.error('console.error stuff');
        assert.strictEqual(myStderr1.read(), 'console.error stuff\n');
      }

      function doStdio1Stuff() {
        var wrappedStdio2Stuff = myStdioContext2.wrap(doStdio2Stuff);
        wrappedStdio2Stuff();
      }

      var wrappedStdio1Stuff = myStdioContext1.wrap(doStdio1Stuff);
      wrappedStdio1Stuff();
    });

    it('updates console as necessary', function() {
      var myStdout1 = new stream.PassThrough({objectMode: true});
      var myStderr1 = new stream.PassThrough({objectMode: true});
      var myStdioContext1 = new StdioContext({
        stdout: myStdout1,
        stderr: myStderr1
      });

      var myStdout2 = new stream.PassThrough({objectMode: true});
      var myStdioContext2 = new StdioContext({
        stdout: myStdout2
      });

      var myStderr3 = new stream.PassThrough({objectMode: true});
      var myStdioContext3 = new StdioContext({
        stderr: myStderr3
      });

      function doStdio2Stuff() {
        console.log('console.log stuff');
        assert.strictEqual(myStdout2.read(), 'console.log stuff\n');
        console.error('console.error stuff');
        assert.strictEqual(myStderr1.read(), 'console.error stuff\n');
      }

      function doStdio3Stuff() {
        console.log('console.log stuff');
        assert.strictEqual(myStdout1.read(), 'console.log stuff\n');
        console.error('console.error stuff');
        assert.strictEqual(myStderr3.read(), 'console.error stuff\n');
      }

      function doStdio1Stuff() {
        var wrappedStdio2Stuff = myStdioContext2.wrap(doStdio2Stuff);
        wrappedStdio2Stuff();

        var wrappedStdio3Stuff = myStdioContext3.wrap(doStdio3Stuff);
        wrappedStdio3Stuff();

        var console1 = console;
        new StdioContext({}).wrap(function() {
          assert.strictEqual(console, console1);
        })();
      }

      var wrappedStdio1Stuff = myStdioContext1.wrap(doStdio1Stuff);
      wrappedStdio1Stuff();
    });

    it('preserves enumerability and writability of stdio streams', function() {
      var myStdin = new stream.PassThrough();
      var myStdout = new stream.PassThrough();
      var myStderr = new stream.PassThrough();

      var myStdioContext = new StdioContext({
        stdin: myStdin,
        stdout: myStdout,
        stderr: myStderr
      });

      function assertedProps(descriptor) {
        return {
          enumerable: descriptor.enumerable,
          // writable only applies to data descriptors
          // use presence of setter as the accessor analog
          writable: descriptor.writable !== undefined ?
            descriptor.writable :
            Boolean(descriptor.set)
        };
      }

      var stdioNames = ['stdin', 'stdout', 'stderr'];
      var origDescriptors = stdioNames
        .map(function(stdioName) {
          return Object.getOwnPropertyDescriptor(process, stdioName);
        })
        .map(assertedProps);

      function doStdioStuff() {
        var myDescriptors = stdioNames
          .map(function(stdioName) {
            return Object.getOwnPropertyDescriptor(process, stdioName);
          })
          .map(assertedProps);

        deepEqual(myDescriptors, origDescriptors);
      }

      var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
      wrappedStdioStuff();
    });

    // This is certainly an edge case, but since the stream API doesn't provide
    // a way to check if a stream has ended, this can be a useful guarantee.
    it('empty stdin doesn\'t end until read', function(done) {
      var myStdioContext = new StdioContext({stdin: null});

      var stdin2Ended = false;
      function doStdio2Stuff(cb) {
        var stdin2Read = false;

        process.stdin.on('end', function() {
          stdin2Ended = true;
          assert.strictEqual(stdin2Read, true);
          cb();
        });
        setImmediate(function() {
          stdin2Read = true;
          assert.strictEqual(process.stdin.read(), null);
        });
      }

      function doStdioStuff(cb) {
        var stdin1Read = false;

        process.stdin.on('end', function() {
          assert.strictEqual(stdin2Ended, true);
          assert.strictEqual(stdin1Read, true);
          cb();
        });

        var wrappedStdio2Stuff = myStdioContext.wrap(doStdio2Stuff);
        wrappedStdio2Stuff(function(err) {
          assert.ifError(err);
          stdin1Read = true;
          assert.strictEqual(process.stdin.read(), null);
        });
      }

      var wrappedStdioStuff = myStdioContext.wrap(doStdioStuff);
      wrappedStdioStuff(done);
    });

    it('must be called on an StdioContext', function() {
      assert.throws(function() {
        StdioContext.prototype.wrap.call(null, function() {});
      });
    });

    it('requires a function', function() {
      assert.throws(function() {
        new StdioContext({}).wrap(true);
      }, function(err) {
        return err instanceof TypeError && /function/i.test(err.message);
      });
    });
  });

  describe('#exec()', function() {
    it('invokes its argument immediately', function() {
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

      myStdioContext.exec(doStdioStuff);
    });

    it('passes arguments, and return value', function() {
      var myStdioContext = new StdioContext({
        stdin: new stream.PassThrough(),
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      var stuffArgs = [undefined, {}];
      var stuffRetVal = {};
      function doStdioStuff() {
        deepEqual(Array.prototype.slice.call(arguments), stuffArgs);
        return stuffRetVal;
      }

      var execArgs = [doStdioStuff].concat(stuffArgs);
      var execRetVal = myStdioContext.exec.apply(myStdioContext, execArgs);
      assert.strictEqual(execRetVal, stuffRetVal);
    });
  });

  describe('#wrapSync()', function() {
    it('restores stdio streams on return for all functions', function() {
      var origStdin = process.stdin;
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdioContext = new StdioContext({
        stdin: new stream.PassThrough(),
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      // Apparently async function that isn't
      function doStdioStuff(cb) {
        return new Promise(function(resolve, reject) {});
      }

      var wrappedStdioStuff = myStdioContext.wrapSync(doStdioStuff);
      wrappedStdioStuff(function() {});

      assert.strictEqual(process.stdin, origStdin);
      assert.strictEqual(process.stdout, origStdout);
      assert.strictEqual(process.stderr, origStderr);
    });

    it('restores stdio streams on exception from function', function() {
      var origStdin = process.stdin;
      var origStdout = process.stdout;
      var origStderr = process.stderr;

      var myStdioContext = new StdioContext({
        stdin: new stream.PassThrough(),
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      var testErr = new Error('test');
      function doStdioStuff() {
        throw testErr;
      }

      var wrappedStdioStuff = myStdioContext.wrapSync(doStdioStuff);

      assert.throws(
        wrappedStdioStuff,
        function(err) { return err === testErr; }
      );

      assert.strictEqual(process.stdin, origStdin);
      assert.strictEqual(process.stdout, origStdout);
      assert.strictEqual(process.stderr, origStderr);
    });

    it('doesn\'t wrap callback argument', function() {
      var myStdioContext = new StdioContext({stdin: new stream.PassThrough()});

      function callback() {}
      function doStdioStuff(cb) {
        assert.strictEqual(cb, callback);
      }

      var wrappedStdioStuff = myStdioContext.wrapSync(doStdioStuff);
      wrappedStdioStuff(callback);
    });

    it('must be called on an StdioContext', function() {
      assert.throws(function() {
        StdioContext.prototype.wrapSync.call(null, function() {});
      });
    });

    it('requires a function', function() {
      assert.throws(function() {
        new StdioContext({}).wrapSync(true);
      }, function(err) {
        return err instanceof TypeError && /function/i.test(err.message);
      });
    });
  });

  describe('#execSync()', function() {
    it('invokes its argument immediately', function() {
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

      myStdioContext.execSync(doStdioStuff);
    });

    it('passes arguments, and return value', function() {
      var myStdioContext = new StdioContext({
        stdin: new stream.PassThrough(),
        stdout: new stream.PassThrough(),
        stderr: new stream.PassThrough()
      });

      var stuffArgs = [undefined, {}];
      var stuffRetVal = {};
      function doStdioStuff() {
        deepEqual(Array.prototype.slice.call(arguments), stuffArgs);
        return stuffRetVal;
      }

      var execArgs = [doStdioStuff].concat(stuffArgs);
      var execRetVal = myStdioContext.execSync.apply(myStdioContext, execArgs);
      assert.strictEqual(execRetVal, stuffRetVal);
    });
  });

  describe('#enter() and #exit()', function() {
    it('replaces stdio streams in a defined region', function() {
      var myStdin = new stream.PassThrough({objectMode: true});
      var myStdout = new stream.PassThrough({objectMode: true});
      var myStderr = new stream.PassThrough({objectMode: true});

      var myStdioContext = new StdioContext({
        stdin: myStdin,
        stdout: myStdout,
        stderr: myStderr
      });

      myStdioContext.enter();
      try {
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
      } finally {
        myStdioContext.exit();
      }
    });

    describe('if strict', function() {
      it('throws for extra #exit()', function() {
        var myStdioContext = new StdioContext({strict: true});

        myStdioContext.enter();
        myStdioContext.exit();
        assert.throws(function() {
          myStdioContext.exit();
        });
      });

      it('throws without exiting for mismatched #exit()', function() {
        var myStderr1 = new stream.PassThrough({objectMode: true});
        var myStdioContext1 = new StdioContext({
          stderr: myStderr1,
          strict: true
        });

        var myStderr2 = new stream.PassThrough({objectMode: true});
        var myStdioContext2 = new StdioContext({
          stderr: myStderr2,
          strict: true
        });

        myStdioContext1.enter();
        myStdioContext2.enter();
        assert.throws(function() {
          myStdioContext1.exit();
        }, /Mismatched/i);

        process.stderr.write('err stuff');
        assert.strictEqual(myStderr2.read(), 'err stuff');

        myStdioContext2.exit();
        myStdioContext1.exit();
      });
    });

    describe('if not strict', function() {
      it('ignores extra #exit()', function() {
        var myStdioContext = new StdioContext({});

        myStdioContext.enter();
        myStdioContext.exit();
        myStdioContext.exit();
      });

      it('mismatched #exit() exits w/o changing current context', function() {
        var origStderr = process.stderr;

        var myStderr1 = new stream.PassThrough({objectMode: true});
        var myStdioContext1 = new StdioContext({stderr: myStderr1});

        var myStderr2 = new stream.PassThrough({objectMode: true});
        var myStdioContext2 = new StdioContext({stderr: myStderr2});

        myStdioContext1.enter();
        myStdioContext2.enter();
        // This exit causes myStdioContext1 to be closed, but leaves the global
        // variables, belonging to the current context unchanged
        myStdioContext1.exit();

        // Still in myStdioContext2
        process.stderr.write('err stuff');
        assert.strictEqual(myStderr2.read(), 'err stuff');

        myStdioContext2.exit();

        // Now outside of both contexts
        assert.strictEqual(process.stderr, origStderr);
      });
    });
  });

  describe('StdioContext()', function() {
    it('can take an Array argument of streams', function() {
      var myStdin = new stream.PassThrough({objectMode: true});
      var myStdout = new stream.PassThrough({objectMode: true});
      var myStderr = new stream.PassThrough({objectMode: true});

      var myStdioContext = new StdioContext([myStdin, myStdout, myStderr]);

      function doStdioStuff() {
        assert.strictEqual(process.stdin, myStdin);
        assert.strictEqual(process.stdout, myStdout);
        assert.strictEqual(process.stderr, myStderr);
        console.log('console.log stuff');
        assert.strictEqual(myStdout.read(), 'console.log stuff\n');
        console.error('console.error stuff');
        assert.strictEqual(myStderr.read(), 'console.error stuff\n');
      }

      var wrappedStdioStuff = myStdioContext.wrapSync(doStdioStuff);
      wrappedStdioStuff();
    });

    it('requires an options object with no invalid streams', function() {
      /* eslint-disable new-cap */
      assert.throws(function() {
        StdioContext();
      }, TypeError);

      assert.throws(function() {
        StdioContext(true);
      }, TypeError);

      ['stdin', 'stdout', 'stderr'].forEach(function(stdioName) {
        assert.throws(function() {
          var options = {};
          options[stdioName] = true;
          StdioContext(options);
        }, function(err) {
          return err instanceof TypeError &&
            err.message.indexOf(stdioName) >= 0;
        });
      });
      /* eslint-enable new-cap */
    });
  });

// Test argument/option checking
});
