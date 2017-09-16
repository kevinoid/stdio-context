/**
 * @copyright Copyright 2016 Kevin Locke <kevin@kevinlocke.name>
 * @license MIT
 */

'use strict';

var DiscardStream = require('./lib/discard-stream');
var EmptyStream = require('./lib/empty-stream');
var debug = require('debug')('stdio-context');
var inspect = require('util').inspect;

/** Number of StdioContext instances which have been created.
 * Used to assign a serial number to each instance to ease debugging.
 * @private
 */
var instanceCount = 0;

/** Stack of StdioContext states in the order that they were entered.
 * @const
 * @private {!Array<!StdioContextState>}
 */
var contextStack = [];

/** State information for {@link StdioContext}.
 *
 * @typedef {{
 *   context: !StdioContext,
 *   exited: boolean,
 *   beforeEnter: !{
 *     console: ObjectPropertyDescriptor|undefined,
 *     stdin: ObjectPropertyDescriptor|undefined,
 *     stdout: ObjectPropertyDescriptor|undefined,
 *     stderr: ObjectPropertyDescriptor|undefined
 *   },
 *   afterEnter: !{
 *     console: ObjectPropertyDescriptor|undefined,
 *     stdin: ObjectPropertyDescriptor|undefined,
 *     stdout: ObjectPropertyDescriptor|undefined,
 *     stderr: ObjectPropertyDescriptor|undefined
 *   }
 * }} StdioContextState
 * @property {!StdioContext} context Context for which this state was added.
 * @property {boolean=} exited Has {@link StdioContext#exit()} been called for
 * this state?
 * @property {!Object} beforeEnter Stdio properties changed by the context, as
 * they existed when {@link StdioContext#enter()} was called.
 * @property {!Object} afterEnter Stdio properties changed by the context, as
 * they existed when {@link StdioContext#enter()} returned.
 * @private
 */
// var StdioContextState;

/** util.inspect wrapper for use with debug.
 *
 * Note:  Use https://github.com/visionmedia/debug/pull/266 if accepted
 *
 * @param {*} object Value to inspect.
 * @param {Object} options Inspect options.
 * @return {string} String representation of object.
 * @private
 */
/* istanbul ignore next */
function debugInspect(object, options) {
  if (!debug.enabled) { return ''; }
  // From https://github.com/visionmedia/debug/blob/2.2.0/node.js#L72-L73
  return inspect(object, {
    showHidden: options && options.showHidden,
    depth: options && options.depth,
    colors: options && options.colors !== undefined ? options.colors :
      debug.useColors,
    customInspect: options && options.customInspect
  }).replace(/\s*\n\s*/g, ' ');
}

/** Sets the value of a property, preserving the previous descriptor attributes
 * of the property and returning the descriptor for the previous value.
 *
 * Note:  process.{stdin,stdout,stderr} are getters which initialize the
 * streams on first access.  We try to avoid unnecessary initialization.
 *
 * global.console is a getter which aliases the console module.  We want to
 * preserve that behavior.
 *
 * @param {!Object} obj Object on which to replace the property.
 * @param {string} prop Name of the property to replace.
 * @param {*} value Value of the replacement property.
 * @return {!ObjectPropertyDescriptor|undefined} The descriptor for the
 * property before the new value was set.
 * @private
 */
function replaceProperty(obj, prop, value) {
  var prevDescriptor = Object.getOwnPropertyDescriptor(obj, prop);
  Object.defineProperty(obj, prop, {
    configurable: true,
    enumerable: prevDescriptor.enumerable,
    writable: prevDescriptor.writable || Boolean(prevDescriptor.set),
    value: value
  });
  return prevDescriptor;
}

/** Checks if a property has a given property descriptor.
 * @param {!Object} obj Object on which to compare the property.
 * @param {string} prop Name of the property to compare.
 * @param {ObjectPropertyDescriptor} descriptor Descriptor against which to
 * compare.
 * @return {boolean} <code>true</code> if <code>descriptor</code> is equal to
 * the descriptor for <code>prop</code>.  <code>false</code> otherwise.
 * @private
 */
function hasOwnPropertyDescriptor(obj, prop, descriptor) {
  var propDescriptor = Object.getOwnPropertyDescriptor(obj, prop);
  return propDescriptor &&
    propDescriptor.configurable === descriptor.configurable &&
    propDescriptor.enumerable === descriptor.enumerable &&
    propDescriptor.get === descriptor.get &&
    propDescriptor.set === descriptor.set &&
    propDescriptor.value === descriptor.value &&
    propDescriptor.writable === descriptor.writable;
}

/** Restores the state of the stdio streams from before a context was entered.
 * @param {!StdioContextState} contextState State to restore.
 * @private
 */
function restoreState(contextState) {
  var context = contextState.context;
  var opts = context._options;
  var afterEnter = contextState.afterEnter;
  var beforeEnter = contextState.beforeEnter;

  debug('restoring state from StdioContext %s', context._name,
    debugInspect(opts, {depth: 0}));

  function restoreProp(obj, prop) {
    if (beforeEnter[prop]) {
      if (opts.overwrite ||
          hasOwnPropertyDescriptor(obj, prop, afterEnter[prop])) {
        Object.defineProperty(obj, prop, beforeEnter[prop]);
      } else if (opts.strict) {
        throw new Error(prop + ' modified outside StdioContext');
      }
    }
  }

  restoreProp(process, 'stdin');
  restoreProp(process, 'stdout');
  restoreProp(process, 'stderr');
  restoreProp(global, 'console');
}

/** Options for {@link StdioContext}.
 *
 * @typedef {{
 *   overwrite: boolean|undefined,
 *   stdin: stream.Readable|undefined,
 *   stdout: stream.Writable|undefined,
 *   stderr: stream.Writable|undefined,
 *   strict: boolean|undefined
 * }} StdioContextOptions
 * @property {boolean=} overwrite Overwrite the current stdio stream value when
 * exiting?
 * @property {stream.Readable=} stdin Stream which will act as
 * <code>stdin</code>.  <code>null</code> for empty input.
 * <code>undefined</code> to leave <code>stdin</code> unchanged.
 * @property {stream.Writable=} stdout Stream which will act as
 * <code>stdout</code>.  <code>null</code> to discard output.
 * <code>undefined</code> to leave <code>stdout</code> unchanged.
 * @property {stream.Writable=} stderr Stream which will act as
 * <code>stderr</code>.  <code>null</code> to discard output.
 * <code>undefined</code> to leave <code>stderr</code> unchanged.
 * @property {boolean=} strict Throw an exception if {@see StdioContext#exit}
 * is improperly paired with {@see StdioContext#enter} or the streams have
 * been modified outside of StdioContext and <code>overwrite</code> is falsey.
 */
// var StdioContextOptions;

/** Creates a stdio context in which the given streams will be used as
 * <code>stdin</code>, <code>stdout</code>, and <code>stderr</code>.
 *
 * @constructor
 * @param {StdioContextOptions|Array<!stream.Readable|!stream.Writable>}
 * options Streams which will be used as <code>stdin</code>,
 * <code>stdout</code>, and <code>stderr</code> either as an object with named
 * properties or an <code>Array</code> of <code>[stdin, stdout, stderr]</code>.
 * @see StdioContextOptions
 */
function StdioContext(options) { // eslint-disable-line consistent-return
  if (!(this instanceof StdioContext)) { return new StdioContext(options); }

  if (!options || typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }

  var opts = {};
  Object.keys(options).forEach(function(prop) {
    // Accept child_process stdio argument type
    var destProp =
      prop === '0' ? 'stdin' :
        prop === '1' ? 'stdout' :
          prop === '2' ? 'stderr' :
            prop;
    opts[destProp] = options[prop];
  });
  this._options = opts;

  // Note:  .read() was not part of Readable in Streams v1
  if (opts.stdin && typeof opts.stdin.pipe !== 'function') {
    throw new TypeError('opts.stdin must be a stream.Readable');
  }
  if (opts.stdout && typeof opts.stdout.write !== 'function') {
    throw new TypeError('opts.stdout must be a stream.Writable');
  }
  if (opts.stderr && typeof opts.stderr.write !== 'function') {
    throw new TypeError('opts.stderr must be a stream.Writable');
  }

  // Name for debug logging
  instanceCount += 1;
  this._name = instanceCount.toString(16);
}

/** Enters this stdio context and starts using the stdio streams it defines.
 * @see StdioContext#exit
 */
StdioContext.prototype.enter = function enter() {
  var opts = this._options;

  debug('#enter() StdioContext %s', this._name, debugInspect(opts, {depth: 0}));

  var stdin = opts.stdin;
  if (stdin === null) {
    stdin = new EmptyStream();
  }

  var stdout = opts.stdout;
  if (stdout === null) {
    stdout = new DiscardStream();
  }

  var stderr = opts.stderr;
  if (stderr === null) {
    stderr = new DiscardStream();
  }

  // State of modified stdio streams when this method was called
  var beforeEnter = {
    stdin: stdin && replaceProperty(process, 'stdin', stdin),
    stdout: stdout && replaceProperty(process, 'stdout', stdout),
    stderr: stderr && replaceProperty(process, 'stderr', stderr)
  };

  // State of modified stdio streams when this method exits
  var afterEnter = {
    stdin: stdin && Object.getOwnPropertyDescriptor(process, 'stdin'),
    stdout: stdout && Object.getOwnPropertyDescriptor(process, 'stdout'),
    stderr: stderr && Object.getOwnPropertyDescriptor(process, 'stderr')
  };

  if (stdout || stderr) {
    var Console = console.Console; // eslint-disable-line no-console
    var newConsole = new Console(process.stdout, process.stderr);
    // Constructor doesn't add the Console property.
    // Add it for consistent behavior and nested contexts
    newConsole.Console = Console;

    beforeEnter.console = replaceProperty(global, 'console', newConsole);
    afterEnter.console = Object.getOwnPropertyDescriptor(global, 'console');
  }

  contextStack.push({
    context: this,
    exited: false,
    beforeEnter: beforeEnter,
    afterEnter: afterEnter
  });
};

/** Exits this stdio context, stops using the stdio streams it defines, and
 * restores the stdio streams present when <code>enter()</code> was called.
 * @throws {Error} If this instance was constructed with
 * <code>options.strict</code> and the streams do not have the values set by
 * {@link StdioContext#enter}.
 * @see StdioContext#enter
 */
StdioContext.prototype.exit = function exit() {
  var self = this;
  var opts = this._options;

  debug('#exit() StdioContext %s', this._name, debugInspect(opts, {depth: 0}));

  function stateForThisContext(state) { return state.context === self; }
  var contextInd = contextStack.length - 1;
  while (contextInd >= 0 &&
      !stateForThisContext(contextStack[contextInd])) {
    contextInd -= 1;
  }
  if (contextInd < 0) {
    debug('#exit() called on a context which has already exited completely.');
    if (opts.strict) { throw new Error('Extra StdioContext#exit()'); }
    return;
  }

  if (contextInd !== contextStack.length - 1) {
    debug('#exit() called on a non-current context.');
    if (opts.strict) { throw new Error('Mismatched StdioContext#exit()'); }
    // TODO:  We could exit the context by restoring streams not overwritten
    // by later contexts.  This is subtle and requires modification of context
    // and preceding enter state.  Holding off until there is a real use case.
    contextStack[contextInd].exited = true;
    return;
  }

  contextStack[contextInd].exited = true;

  while (contextStack.length > 0 &&
      contextStack[contextStack.length - 1].exited) {
    restoreState(contextStack.pop());
  }
};

/**
 * Executes a function, which may be either synchronous or asynchronous, such
 * that it executes in this stdio context.
 *
 * This function behaves as if it called {@link #wrap} and immediately invoked
 * the result with the remaining arguments.
 *
 * @ template ReturnType
 * @param {function(...*): ReturnType} func Function to execute.
 * @param {...*} args Arguments passed to <code>func</code>.
 * @return {ReturnType} Value returned by <code>func</code>.
 * @see #wrap
 */
StdioContext.prototype.exec = function exec(func) {
  var wrapped = this.wrap(func);
  if (arguments.length === 1) {
    return wrapped();
  }

  var args = new Array(arguments.length - 1);
  for (var i = 1; i < arguments.length; i += 1) {
    args[i - 1] = arguments[i];
  }
  return wrapped.apply(null, args);
};

/**
 * Executes a synchronous function such that it executes in this stdio context.
 *
 * This function behaves as if it called {@link #wrap} and immediately invoked
 * the result with the remaining arguments.
 *
 *
 * @ template ReturnType
 * @param {function(...*): ReturnType} func Function to execute.
 * @param {...*} args Arguments passed to <code>func</code>.
 * @return {ReturnType} Value returned by <code>func</code>.
 * @see #wrapSync
 */
StdioContext.prototype.execSync = function execSync(func) {
  var wrapped = this.wrapSync(func);
  if (arguments.length === 1) {
    return wrapped();
  }

  var args = new Array(arguments.length - 1);
  for (var i = 1; i < arguments.length; i += 1) {
    args[i - 1] = arguments[i];
  }
  return wrapped.apply(null, args);
};

/**
 * Wraps a function, which may be either synchronous or asynchronous, such that
 * it executes in this stdio context.
 *
 * This stdio context is entered when the returned wrapper function is called
 * and exited under any of the following conditions:
 * - When the wrapped function throws an exception.
 * - When the wrapped function returns, if it didn't return a
 *   <code>Promise</code> and the last argument was not a function.
 * - When a <code>Promise</code> returned by the function is resolved or
 *   rejected.
 * - When a function passed as the last argument to the function is called.
 *
 * @ template Func
 * @param {Func} func Function to wrap.
 * @return {Func} A function which enters this stdio context, invokes
 * <code>func</code> with the arguments given and a wrapped callback, if
 * present.  Then exits this stdio context when the callback is first called,
 * or when the returned Promise is resolved or rejected, or immediately if the
 * invoked function throws an exception or doesn't have a Promise or callback.
 * @see #wrapSync
 */
StdioContext.prototype.wrap = function wrap(func) {
  // Since errors wouldn't be thrown until wrapped function is invoked, check em
  if (!(this instanceof StdioContext)) {
    throw new TypeError('wrap must be called on an StdioContext');
  }
  if (typeof func !== 'function') {
    throw new TypeError('func must be a function');
  }

  var stdioContext = this;
  return function stdioWrapped() {
    var exited = false;
    function exitStdioContext() {
      if (!exited) {
        exited = true;
        stdioContext.exit();
      }
    }

    var hasCallback = false;
    var callback = arguments[arguments.length - 1];
    if (typeof callback === 'function') {
      hasCallback = true;
      arguments[arguments.length - 1] = function stdioWrappedCallback() {
        exitStdioContext();
        return callback.apply(this, arguments);
      };
    }

    stdioContext.enter();

    var result;
    try {
      result = func.apply(this, arguments);
    } catch (err) {
      exitStdioContext();
      throw err;
    }

    if (result && typeof result.then === 'function') {
      // finally: https://github.com/domenic/promises-unwrapping/issues/18
      return result.then(
        function(value) { exitStdioContext(); return value; },
        function(reason) { exitStdioContext(); throw reason; }
      );
    }

    if (!hasCallback) {
      exitStdioContext();
    }

    return result;
  };
};

/**
 * Wraps a synchronous function such that it executes in this stdio context.
 *
 * This stdio context is entered when the returned wrapper function is called
 * and exited when the wrapped function returns or throws an exception.
 *
 * @ template Func
 * @param {Func} func Function to wrap.
 * @return {Func} A function which enters this stdio context, invokes
 * <code>func</code> with the arguments given, then exits this stdio context
 * upon return or exception from <code>func</code>.
 * @see #wrapSync
 */
StdioContext.prototype.wrapSync = function wrapSync(func) {
  // Since errors wouldn't be thrown until wrapped function is invoked, check em
  if (!(this instanceof StdioContext)) {
    throw new TypeError('wrapSync must be called on an StdioContext');
  }
  if (typeof func !== 'function') {
    throw new TypeError('func must be a function');
  }

  var stdioContext = this;
  return function stdioWrappedSync() {
    stdioContext.enter();
    try {
      return func.apply(this, arguments);
    } finally {
      stdioContext.exit();
    }
  };
};

module.exports = StdioContext;
