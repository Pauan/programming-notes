(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":3}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
"use strict";

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _Queue$array_remove = require("./Util");

var check_length = function check_length(i) {
  // TODO should we allow for a buffer of size 0 ?
  if (i >= 1) {
    return true;
  } else {
    throw new Error("Expected 1 or greater but got " + i);
  }
};

var closed_peek = function closed_peek(action) {
  if (this._buffer.length) {
    action.success(this._buffer.peek());
  } else {
    action.cancel();
  }
};

var closed_pull = function closed_pull(action) {
  if (this._buffer.length) {
    action.success(this._buffer.pull());
  } else {
    action.cancel();
  }
};

var closed_push = function closed_push(action, value) {
  action.cancel();
};

var closed_close = function closed_close(action) {
  // TODO is this correct ? maybe it should simply do nothing if you close a Stream multiple times
  action.error(new Error("Cannot close: stream is already closed"));
};

var StreamBase = (function () {
  function StreamBase(limit) {
    _classCallCheck(this, StreamBase);

    this._limit = limit;
    this._pullers = []; // TODO maybe use a Queue ?
    this._buffer = new _Queue$array_remove.Queue();
  }

  _createClass(StreamBase, [{
    key: "cleanup",
    value: function cleanup() {
      var a = this._pullers;

      this._limit = null;
      this._pullers = null;

      // TODO is it faster to use var or let ?
      // This cancels any pending peek/pull
      // This only happens if the buffer is empty
      for (var i = 0; i < a.length; ++i) {
        a[i].action.cancel();
      }
    }
  }, {
    key: "close",
    value: function close(action) {
      this.peek = closed_peek;
      this.pull = closed_pull;
      this.push = closed_push;
      this.close = closed_close;

      // TODO is this executed in the right order ?
      this.cleanup();

      // TODO should this cancel ?
      action.success(undefined);
    }
  }, {
    key: "peek",
    value: function peek(action) {
      var _this = this;

      if (this._buffer.length) {
        action.success(this._buffer.peek());
      } else {
        (function () {
          var info = {
            push: true,
            action: action
          };

          _this._pullers.push(info);

          action.onTerminate = function () {
            // TODO is it possible for `this._pullers` to be `null` ?
            _Queue$array_remove.array_remove(_this._pullers, info);
          };
        })();
      }
    }
  }, {
    key: "pull",
    value: function pull(action) {
      var _this2 = this;

      if (this._buffer.length) {
        action.success(this._buffer.pull());
      } else {
        (function () {
          var info = {
            push: false,
            action: action
          };

          _this2._pullers.push(info);

          action.onTerminate = function () {
            // TODO is it possible for `this._pullers` to be `null` ?
            _Queue$array_remove.array_remove(_this2._pullers, info);
          };
        })();
      }
    }
  }, {
    key: "push",
    value: function push(action, value) {
      // If there is a pending pull
      if (this._pullers.length) {
        var f = this._pullers.shift();

        if (f.push) {
          this._buffer.push(value);
        }

        f.action.success(value);
        action.success(undefined);

        // If there is room in the buffer
      } else if (this._buffer.length < this._limit) {
        this._buffer.push(value);
        action.success(undefined);

        // Buffer is full
      } else {
        this.full(action, value);
      }
    }
  }]);

  return StreamBase;
})();

var StreamFixed = (function (_StreamBase) {
  function StreamFixed(limit) {
    _classCallCheck(this, StreamFixed);

    _get(Object.getPrototypeOf(StreamFixed.prototype), "constructor", this).call(this, limit);
    this._pushers = []; // TODO maybe use a Queue ?
  }

  _inherits(StreamFixed, _StreamBase);

  _createClass(StreamFixed, [{
    key: "cleanup",
    value: function cleanup() {
      _get(Object.getPrototypeOf(StreamFixed.prototype), "cleanup", this).call(this);

      var a = this._pushers;

      this._pushers = null;

      // TODO is it faster to use var or let ?
      for (var i = 0; i < a.length; ++i) {
        a[i].action.cancel();
      }
    }
  }, {
    key: "pull",
    value: function pull(action) {
      var _this3 = this;

      // If there is stuff in the buffer
      if (this._buffer.length) {
        var value = this._buffer.pull();

        // If there is a pending push
        if (this._pushers.length) {
          var f = this._pushers.shift();
          this._buffer.push(f.value);
          f.action.success(undefined);
        }

        action.success(value);

        // Buffer is empty, wait for push
      } else {
        (function () {
          var info = {
            push: false,
            action: action
          };

          _this3._pullers.push(info);

          action.onTerminate = function () {
            // TODO is it possible for `this._pullers` to be `null` ?
            _Queue$array_remove.array_remove(_this3._pullers, info);
          };
        })();
      }
    }
  }, {
    key: "full",
    value: function full(action, value) {
      var _this4 = this;

      var info = {
        value: value,
        action: action
      };

      this._pushers.push(info);

      action.onTerminate = function () {
        // TODO is it possible for `this._pushers` to be `null` ?
        _Queue$array_remove.array_remove(_this4._pushers, info);
      };
    }
  }]);

  return StreamFixed;
})(StreamBase);

var StreamSliding = (function (_StreamBase2) {
  function StreamSliding() {
    _classCallCheck(this, StreamSliding);

    if (_StreamBase2 != null) {
      _StreamBase2.apply(this, arguments);
    }
  }

  _inherits(StreamSliding, _StreamBase2);

  _createClass(StreamSliding, [{
    key: "full",
    value: function full(action, value) {
      // TODO more efficient function for this
      this._buffer.pull();
      this._buffer.push(value);
      action.success(undefined);
    }
  }]);

  return StreamSliding;
})(StreamBase);

var StreamDropping = (function (_StreamBase3) {
  function StreamDropping() {
    _classCallCheck(this, StreamDropping);

    if (_StreamBase3 != null) {
      _StreamBase3.apply(this, arguments);
    }
  }

  _inherits(StreamDropping, _StreamBase3);

  _createClass(StreamDropping, [{
    key: "full",
    value: function full(action, value) {
      action.success(undefined);
    }
  }]);

  return StreamDropping;
})(StreamBase);

var stream_fixed = function stream_fixed(i) {
  return function (action) {
    if (check_length(i)) {
      action.success(new StreamFixed(i));
    }
  };
};

exports.stream_fixed = stream_fixed;
var stream_sliding = function stream_sliding(i) {
  return function (action) {
    if (check_length(i)) {
      action.success(new StreamSliding(i));
    }
  };
};

exports.stream_sliding = stream_sliding;
var stream_dropping = function stream_dropping(i) {
  return function (action) {
    if (check_length(i)) {
      action.success(new StreamDropping(i));
    }
  };
};

exports.stream_dropping = stream_dropping;
var peek = function peek(stream) {
  return function (action) {
    stream.peek(action);
  };
};

exports.peek = peek;
var pull = function pull(stream) {
  return function (action) {
    stream.pull(action);
  };
};

exports.pull = pull;
var push = function push(stream, value) {
  return function (action) {
    stream.push(action, value);
  };
};

exports.push = push;
var close = function close(stream) {
  return function (action) {
    stream.close(action);
  };
};
exports.close = close;

},{"./Util":6}],5:[function(require,module,exports){
(function (process){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _array_remove$async$error_stack$fatal_error$print_error = require("./Util");

var RUNNING_TASKS = 0;

// For Node.js only
if (typeof process === "object" && typeof process.on === "function") {
  process.on("uncaughtException", function (e) {
    _array_remove$async$error_stack$fatal_error$print_error.fatal_error("AN UNCAUGHT ERROR OCCURRED!\n\n" + _array_remove$async$error_stack$fatal_error$print_error.error_stack(e));
    process.exit(1);
  });

  // TODO this doesn't seem to work
  process.on("beforeExit", function () {
    console.log("beforeExit");
  });

  process.on("exit", function () {
    // This should never happen, it's just a sanity check, just in case
    if (RUNNING_TASKS !== 0) {
      _array_remove$async$error_stack$fatal_error$print_error.fatal_error("NODE.JS IS EXITING, BUT THERE ARE STILL " + RUNNING_TASKS + " TASKS PENDING!");
    }
  });
}

// TODO it shouldn't allow for calling cleanup_success twice
var cleanup_success = function cleanup_success(value) {};

var cleanup_success_error = function cleanup_success_error(value) {
  // TODO pretty printing for value
  _array_remove$async$error_stack$fatal_error$print_error.fatal_error("INVALID SUCCESS!\n\n" + value);
};

var cleanup_error = function cleanup_error(e) {
  _array_remove$async$error_stack$fatal_error$print_error.fatal_error("INVALID ERROR!\n\n" + _array_remove$async$error_stack$fatal_error$print_error.error_stack(e));
};

var cleanup_cancel = function cleanup_cancel() {
  _array_remove$async$error_stack$fatal_error$print_error.fatal_error("INVALID CANCEL!");
};

var cleanup_terminate = function cleanup_terminate() {
  return false;
};

var cleanup_terminate_error = function cleanup_terminate_error() {
  _array_remove$async$error_stack$fatal_error$print_error.fatal_error("CANNOT TERMINATE THE SAME ACTION TWICE!");
  return false;
};

var cleanup = function cleanup(action, success, terminate) {
  action.success = success;
  action.error = cleanup_error;
  action.cancel = cleanup_cancel;
  action.terminate = terminate;
  action.onTerminate = null;
};

var run = function run(task, onSuccess, onError, onCancel) {
  ++RUNNING_TASKS;

  var action = {
    onTerminate: null,

    success: function success(value) {
      // It's okay to call terminate after success
      cleanup(action, cleanup_success_error, cleanup_terminate);

      _array_remove$async$error_stack$fatal_error$print_error.async(function () {
        onSuccess(value);
        --RUNNING_TASKS;
      });
    },

    error: function error(e) {
      // It's okay to call terminate after error
      cleanup(action, cleanup_success_error, cleanup_terminate);

      _array_remove$async$error_stack$fatal_error$print_error.async(function () {
        onError(e);
        --RUNNING_TASKS;
      });
    },

    cancel: function cancel() {
      // It's okay to call terminate after cancel
      cleanup(action, cleanup_success_error, cleanup_terminate);

      _array_remove$async$error_stack$fatal_error$print_error.async(function () {
        onCancel();
        --RUNNING_TASKS;
      });
    },

    terminate: function terminate() {
      var f = action.onTerminate;

      // It's okay to call success after terminate
      cleanup(action, cleanup_success, cleanup_terminate_error);

      // Not every action supports termination
      if (f !== null) {
        // We can't use `async` (see e.g. _finally, _bind, etc.)
        f();
      }

      --RUNNING_TASKS;
      return true;
    }
  };

  task(action);

  return action;
};

exports.run = run;
// TODO is using `| 0` a good idea? is there a better way to get Chrome to treat them as a small uint ?
var PENDING = 0 | 0;
var SUCCEEDED = 1 | 0;
var ERRORED = 2 | 0;
var CANCELLED = 3 | 0;
var TERMINATED = 4 | 0;

var Thread = (function () {
  function Thread(task) {
    var _this = this;

    _classCallCheck(this, Thread);

    this._state = PENDING;
    this._value = null;
    this._listeners = [];

    // This is to make sure that Node.js doesn't exit until all the Tasks are done
    this._action = run(_finally(task, block()), function (value) {
      if (_this._state === PENDING) {
        var _a = _this._listeners;

        _this._state = SUCCEEDED;
        _this._value = value;
        _this._listeners = null;
        _this._action = null;

        // TODO this can be made a bit faster
        _a.forEach(function (x) {
          x.success(value);
        });
      }
    }, function (e) {
      if (_this._state === PENDING) {
        _this._cancel(ERRORED);
        _array_remove$async$error_stack$fatal_error$print_error.print_error(e);
      }
    }, function () {
      if (_this._state === PENDING) {
        _this._cancel(CANCELLED);
      }
    });
  }

  _createClass(Thread, [{
    key: "_cancel",
    value: function _cancel(new_state) {
      var a = this._listeners;

      // TODO verify that _value is null ?
      this._state = new_state;
      this._listeners = null;
      this._action = null;

      // TODO this can be made a bit faster
      a.forEach(function (x) {
        x.cancel();
      });
    }
  }, {
    key: "wait",
    value: function wait(action) {
      var _this2 = this;

      switch (this._state) {
        case PENDING:
          this._listeners.push(action);

          // TODO test this
          action.onTerminate = function () {
            _array_remove$async$error_stack$fatal_error$print_error.array_remove(_this2._listeners, action);
          };
          break;

        case SUCCEEDED:
          action.success(this._value);
          break;

        // TODO is this correct ?
        case ERRORED:
        case CANCELLED:
        case TERMINATED:
          action.cancel();
          break;
      }
    }
  }, {
    key: "kill",
    value: function kill(action) {
      switch (this._state) {
        case PENDING:
          var t = this._action;
          var a = this._listeners;

          // TODO verify that _value is null ?
          this._state = TERMINATED;
          this._listeners = null;
          this._action = null;

          // TODO this can be made a bit faster
          a.forEach(function (x) {
            x.cancel();
          });

          // TODO should this be before or after cancelling the listeners ?
          t.terminate();
          action.success(undefined);
          break;

        // TODO is this correct ?
        case SUCCEEDED:
        case ERRORED:
        case CANCELLED:
          action.success(undefined);
          break;

        case TERMINATED:
          action.error(new Error("Cannot kill thread: thread is already killed"));
          break;
      }
    }
  }]);

  return Thread;
})();

var noop = function noop() {};

exports.noop = noop;
// There's no standard way to cancel/terminate a Promise
var Task_from_Promise = function Task_from_Promise(f) {
  return function (action) {
    f().then(action.success, action.error);
  };
};

exports.Task_from_Promise = Task_from_Promise;
// TODO how to handle the task/promise being terminated ?
var Promise_from_Task = function Promise_from_Task(task) {
  return new Promise(function (resolve, reject) {
    // TODO is cancellation correctly handled ?
    run(task, resolve, reject, reject);
  });
};

exports.Promise_from_Task = Promise_from_Task;
// TODO does this work properly in all platforms ?
var MAX_TIMER = Math.pow(2, 31) - 1;

// TODO test this
// TODO it creates a new timer for each Thread, it would be better to use a single timer
var block = function block() {
  // This is necessary to prevent Node.js from exiting before the tasks are complete
  // TODO is there a more efficient way to do this ?
  // TODO maybe only do this on Node.js ?
  // TODO maybe provide a way to disable this ?
  // TODO test this
  var timer = setInterval(noop, MAX_TIMER);

  return function (action) {
    clearInterval(timer);
    action.success(undefined);
  };
};

exports.block = block;
var run_root = function run_root(f) {
  // TODO I'd like to use `execute`, but I can't, because `f` returns a `Task`, so I'd have to double-run it
  try {
    // TODO is it inefficient to use _finally here ?
    run(_finally(f(), block()), noop, _array_remove$async$error_stack$fatal_error$print_error.print_error, noop);
  } catch (e) {
    _array_remove$async$error_stack$fatal_error$print_error.print_error(e);
  }
};

exports.run_root = run_root;
// This can be implemented entirely with `execute`,
// but it's faster to implement it like this
var success = function success(x) {
  return function (action) {
    action.success(x);
  };
};

exports.success = success;
var error = function error(s) {
  // TODO better stack traces
  var e = new Error(s);
  return function (action) {
    action.error(e);
  };
};

exports.error = error;
var cancel = function cancel() {
  return function (action) {
    action.cancel();
  };
};

exports.cancel = cancel;
// TODO what if the action is terminated ?
var never = function never() {
  return function (action) {};
};

exports.never = never;
var _bind = function _bind(task, f) {
  return function (action) {
    // TODO is this necessary ?
    var terminated = false;

    var onSuccess = function onSuccess(value) {
      if (!terminated) {
        action.onTerminate = null;

        // Runs the task in a tail-recursive manner, so that it consumes a
        // constant amount of memory, even if it's an infinite loop
        f(value)(action);

        /*const a2 = run(f(value), action.success, action.error, action.cancel);
         // TODO is it even possible for this to occur ?
        action.onTerminate = () => {
          a2.terminate();
        };*/
      }
    };

    // TODO slightly inefficient
    // TODO is this needed to prevent a memory leak of `a1` ?
    (function () {
      var a1 = run(task, onSuccess, action.error, action.cancel);

      action.onTerminate = function () {
        terminated = true;
        a1.terminate();
      };
    })();
  };
};

exports._bind = _bind;
// TODO test this
var with_resource = function with_resource(before, during, after) {
  return function (action) {
    var terminated = false;

    // This is always run, even if it's terminated
    run(before, function (value) {
      action.onTerminate = null;

      if (terminated) {
        // This is always run, even if it's terminated
        // TODO maybe this should use `after(value)(action)` instead ?
        run(after(value), noop, action.error, action.cancel);
      } else {
        // There's no need to create a new action for this, so we just use the existing one
        _finally(during(value), after(value))(action);
      }
    }, action.error, action.cancel);

    action.onTerminate = function () {
      terminated = true;
    };
  };
};

exports.with_resource = with_resource;
var _finally = function _finally(before, after) {
  return function (action) {
    var onSuccess = function onSuccess(value) {
      // TODO is this necessary to prevent a memory leak ?
      action.onTerminate = null;

      // This task is run no matter what, even if it is terminated
      run(after, function (_) {
        action.success(value);
      }, action.error, action.cancel);
    };

    var onError = function onError(e) {
      // TODO is this necessary to prevent a memory leak ?
      action.onTerminate = null;

      // Errors have precedence over cancellations
      var propagate = function propagate() {
        action.error(e);
      };

      // This task is run no matter what, even if it is terminated
      run(after, propagate, action.error, propagate);
    };

    var onCancel = function onCancel() {
      // TODO is this necessary to prevent a memory leak ?
      action.onTerminate = null;

      // This task is run no matter what, even if it is terminated
      run(after, action.cancel, action.error, action.cancel);
    };

    // TODO slightly inefficient
    // TODO is this needed to prevent a memory leak of `t` ?
    (function () {
      var t = run(before, onSuccess, onError, onCancel);

      action.onTerminate = function () {
        if (t.terminate()) {
          // This task is run no matter what, even if it is terminated
          // There's nothing to return, so we use `noop`
          // TODO can this be implemented as `after(action)` ?
          run(after, noop, action.error, action.cancel);
        }
      };
    })();
  };
};

exports._finally = _finally;
var on_cancel = function on_cancel(x, y) {
  return function (action) {
    var terminated = false;

    var onCancel = function onCancel() {
      // TODO maybe this should execute even if it was terminated ?
      if (!terminated) {
        action.onTerminate = null;

        // TODO is this correct ?
        y(action);

        /*const t2 = run(y, action.success, action.error, action.cancel);
         // TODO should this terminate ?
        action.onTerminate = () => {
          t2.terminate();
        };*/
      }
    };

    // TODO slightly inefficient
    // TODO is this needed to prevent a memory leak of `t1` ?
    (function () {
      var t1 = run(x, action.success, action.error, onCancel);

      action.onTerminate = function () {
        terminated = true;
        t1.terminate();
      };
    })();
  };
};

exports.on_cancel = on_cancel;
var execute = function execute(f) {
  return function (action) {
    try {
      action.success(f());
    } catch (e) {
      action.error(e);
    }
  };
};

exports.execute = execute;
// This can be implemented entirely with bind + wrap,
// but it's more efficient to implement it with the FFI
var ignore = function ignore(task) {
  return function (action) {
    var t = run(task, function (_) {
      action.success(undefined);
    }, action.error, action.cancel);

    action.onTerminate = function () {
      t.terminate();
    };
  };
};

exports.ignore = ignore;
var thread = function thread(task) {
  return function (action) {
    action.success(new Thread(task));
  };
};

exports.thread = thread;
var thread_wait = function thread_wait(thread) {
  return function (action) {
    thread.wait(action);
  };
};

exports.thread_wait = thread_wait;
var thread_kill = function thread_kill(thread) {
  return function (action) {
    thread.kill(action);
  };
};

exports.thread_kill = thread_kill;
var terminateAll = function terminateAll(actions) {
  // TODO is it faster to use a var or a let ?
  for (var i = 0; i < actions.length; ++i) {
    actions[i].terminate();
  }
};

exports.terminateAll = terminateAll;
// TODO verify that this works correctly in all situations
// This can be implemented entirely in Nulan, but it's much more efficient to implement it in here
var sequential = function sequential(a) {
  return function (action) {
    var out = new Array(a.length);

    var terminated = false;

    var loop = (function (_loop) {
      function loop(_x) {
        return _loop.apply(this, arguments);
      }

      loop.toString = function () {
        return _loop.toString();
      };

      return loop;
    })(function (i) {
      if (i < a.length) {
        (function () {
          var onSuccess = function onSuccess(value) {
            if (!terminated) {
              action.onTerminate = null;
              out[i] = value;
              loop(i + 1);
            }
          };

          // TODO slightly inefficient
          // TODO is this needed to prevent a memory leak of `t` ?
          (function () {
            var t = run(a[i], onSuccess, action.error, action.cancel);

            action.onTerminate = function () {
              terminated = true;
              t.terminate();
            };
          })();
        })();
      } else {
        action.success(out);
      }
    });

    loop(0);
  };
};

exports.sequential = sequential;
// TODO verify that this works correctly in all situations
var concurrent = function concurrent(a) {
  return function (action) {
    var out = new Array(a.length);

    var actions = [];

    var pending = a.length;

    var failed = false;

    var onTerminate = function onTerminate() {
      if (!failed) {
        failed = true;
        terminateAll(actions);
      }
    };

    var onSuccess = function onSuccess() {
      if (!failed) {
        --pending;
        if (pending === 0) {
          action.success(out);
        }
      }
    };

    var onError = function onError(e) {
      onTerminate();
      // Always emit all the errors
      // The error that is emitted first is non-deterministic
      action.error(e);
    };

    var onCancel = function onCancel() {
      onTerminate();
      action.cancel();
    };

    var _loop2 = function (i) {
      // TODO test that this is always called asynchronously
      // TODO does this leak `t` after `a[i]` succeeds ?
      var t = run(a[i], function (value) {
        out[i] = value;
        onSuccess();
      }, onError, onCancel);

      actions.push(t);
    };

    for (var i = 0; i < a.length; ++i) {
      _loop2(i);
    }

    action.onTerminate = onTerminate;
  };
};

exports.concurrent = concurrent;
// TODO verify that this works correctly in all situations
var fastest = function fastest(a) {
  return function (action) {
    var actions = [];

    var done = false;

    var onTerminate = function onTerminate() {
      if (!done) {
        done = true;
        terminateAll(actions);
      }
    };

    var onSuccess = function onSuccess(value) {
      onTerminate();
      action.success(value);
    };

    var onError = function onError(e) {
      onTerminate();
      // Always emit all the errors
      // The error that is emitted first is non-deterministic
      action.error(e);
    };

    // TODO should it only cancel if all the tasks fail ?
    var onCancel = function onCancel() {
      onTerminate();
      action.cancel();
    };

    // TODO is it faster to use var or let ?
    for (var i = 0; i < a.length; ++i) {
      // TODO test that this is always called asynchronously
      actions.push(run(a[i], onSuccess, onError, onCancel));
    }

    action.onTerminate = onTerminate;
  };
};

exports.fastest = fastest;
// Often-used functionality
var delay = function delay(ms) {
  return function (action) {
    var timer = setTimeout(function () {
      action.success(undefined);
    }, ms);

    action.onTerminate = function () {
      clearTimeout(timer);
    };
  };
};

exports.delay = delay;
var log = function log(s) {
  return function (action) {
    console.log(s);
    action.success(undefined);
  };
};
exports.log = log;

}).call(this,require('_process'))
},{"./Util":6,"_process":3}],6:[function(require,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, "__esModule", {
  value: true
});
var error_stack = function error_stack(e) {
  if (e.stack != null) {
    return e.stack;
  } else {
    return e;
  }
};

exports.error_stack = error_stack;
var fatal_error = function fatal_error(s) {
  console.error("\n" + "=".repeat(50) + "\n" + s + "\n" + "=".repeat(50));
};

exports.fatal_error = fatal_error;
var print_error = function print_error(e) {
  console.error(error_stack(e));
};

exports.print_error = print_error;
// This is significantly faster than using Array.prototype.reverse
// http://jsperf.com/array-reverse-function
var reverse = function reverse(array) {
  var left = 0;
  var right = array.length - 1;
  while (left <= right) {
    var tmp = array[left];
    array[left] = array[right];
    array[right] = tmp;

    ++left;
    --right;
  }
};

// This implementation has good performance, but not necessarily faster than a raw Array
// http://jsperf.com/promises-queue

var Queue = (function () {
  function Queue() {
    _classCallCheck(this, Queue);

    this._left = [];
    this._right = [];
    this.length = 0;
  }

  _createClass(Queue, [{
    key: "peek",
    value: function peek() {
      return this._left[this._left.length - 1];
    }
  }, {
    key: "push",
    value: function push(value) {
      if (this.length === 0) {
        this._left.push(value);
      } else {
        this._right.push(value);
      }

      ++this.length;
    }
  }, {
    key: "pull",
    value: function pull() {
      var left = this._left;

      var value = left.pop();

      --this.length;

      if (left.length === 0) {
        var right = this._right;

        if (right.length > 1) {
          reverse(right);
        }

        this._left = right;
        this._right = left;
      }

      return value;
    }
  }]);

  return Queue;
})();

exports.Queue = Queue;

// TODO should this throw an error or something if `x` isn't in `array` ?
// TODO faster implementation of this
var array_remove = function array_remove(array, x) {
  var i = array.indexOf(x);
  if (i !== -1) {
    array.splice(i, 1);
  }
};

exports.array_remove = array_remove;
/*
// TODO use setImmediate shim
export const nextTick =
  // setImmediate is ~52 times faster than setTimeout
  (typeof setImmediate === "function"
    ? setImmediate                   // ~39,000
    : (f) => { setTimeout(f, 0) });  // ~750
*/

var nextTick = function nextTick(f) {
  setImmediate(f);
};

var task_queue = new Queue();

// Arbitrary number, just so long as it's big enough for normal use cases
var TASK_QUEUE_MAX_CAPACITY = 1024;

var TASK_QUEUE_FLUSHING = false;

// Macrotask queue scheduler, similar to setImmediate
var task_queue_flush = function task_queue_flush() {
  if (!TASK_QUEUE_FLUSHING) {
    (function () {
      TASK_QUEUE_FLUSHING = true;

      var loop = (function (_loop) {
        function loop() {
          return _loop.apply(this, arguments);
        }

        loop.toString = function () {
          return _loop.toString();
        };

        return loop;
      })(function () {
        var pending = task_queue.length;

        // Process all the tasks that were queued up, but if more tasks are queued, they are not processed
        do {
          // Pull the task out of the queue and then call it
          task_queue.pull()();
          --pending;
        } while (pending !== 0);

        // We're done processing all of the tasks
        if (task_queue.length === 0) {
          TASK_QUEUE_FLUSHING = false;

          // Process any remaining tasks
        } else {
          // TODO this is necessary in order to terminate infinite loops, but is there a better way ?
          nextTick(loop);
        }
      });

      // TODO this is necessary in order to terminate infinite loops, but is there a better way ?
      nextTick(loop);
    })();
  }
};

// TODO is this a good idea ? it's useful for stuff like Streams, but do we want *all* Tasks to behave this way ?
// TODO use the asap polyfill ?
var async = function async(f) {
  task_queue.push(f);

  // Warn if the task queue gets too big
  if (task_queue.length > TASK_QUEUE_MAX_CAPACITY) {
    console.warn("Task queue has " + task_queue.length + " items, which is greater than the max capacity of " + TASK_QUEUE_MAX_CAPACITY);
  }

  task_queue_flush();
};
exports.async = async;

},{}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _push$pull$close = require("../../FFI/Stream");

// "nulan:Stream"

var _run$_finally$with_resource = require("../../FFI/Task");

// "nulan:Task"

var _fs = require("fs");
var _path = require("path");

var callback = function callback(action) {
  return function (err, value) {
    if (err) {
      action.error(err);
    } else {
      action.success(value);
    }
  };
};

exports.callback = callback;
var read_from_Node = function read_from_Node(input, output) {
  return function (action) {
    var finished = false;

    var cleanup = function cleanup() {
      if (!finished) {
        finished = true;
        input.removeListener("end", onEnd);
        input.removeListener("error", onError);
        input.removeListener("readable", onReadable);
      }
    };

    action.onTerminate = function () {
      cleanup();
    };

    var onEnd = function onEnd() {
      cleanup();
      action.success(undefined);
    };

    var onError = function onError(e) {
      cleanup();
      action.error(e);
    };

    var onReadable = (function (_onReadable) {
      function onReadable() {
        return _onReadable.apply(this, arguments);
      }

      onReadable.toString = function () {
        return _onReadable.toString();
      };

      return onReadable;
    })(function () {
      // TODO is this correct ?
      if (!finished) {
        // TODO should this set a byte size for `read` ?
        var chunk = input.read();
        if (chunk !== null) {
          (function () {
            // TODO is it possible for a "readable" event to trigger even if `chunk` is not `null` ?
            // TODO is it possible for onEnd to be called after the Stream is closed, and thus double-close it ?
            var t = _run$_finally$with_resource.run(_push$pull$close.push(output, chunk), onReadable, onError, onEnd);

            action.onTerminate = function () {
              cleanup();
              t.terminate();
            };
          })();
        }
      }
    });

    input.setEncoding("utf8");

    input.on("end", onEnd);
    input.on("error", onError);
    input.on("readable", onReadable);

    onReadable();
  };
};

exports.read_from_Node = read_from_Node;
var write_to_Node = function write_to_Node(input, output) {
  return function (action) {
    var finished = false;

    var cleanup = function cleanup() {
      if (!finished) {
        finished = true;
        output.removeListener("finish", onFinish);
        output.removeListener("error", onError);
        output.removeListener("drain", onDrain);
        // TODO is this correct ?
        output.end();
      }
    };

    action.onTerminate = function () {
      cleanup();
    };

    // TODO is this correct? maybe get rid of the "finish" event entirely ?
    var onFinish = function onFinish() {
      cleanup();
      action.error(new Error("This should never happen"));
    };

    var onCancel = function onCancel() {
      cleanup();
      action.success(undefined);
    };

    var onError = function onError(e) {
      cleanup();
      action.error(e);
    };

    var onSuccess = function onSuccess(value) {
      // Don't write if the Stream is ended
      if (!finished) {
        if (output.write(value, "utf8")) {
          onDrain();
        }
      }
    };

    var onDrain = function onDrain() {
      if (!finished) {
        (function () {
          var t = _run$_finally$with_resource.run(_push$pull$close.pull(input), onSuccess, onError, onCancel);

          action.onTerminate = function () {
            cleanup();
            t.terminate();
          };
        })();
      }
    };

    // TODO this doesn't work
    //output["setDefaultEncoding"]("utf8");

    output.on("finish", onFinish);
    output.on("error", onError);
    output.on("drain", onDrain);

    // Because Node.js is stupid and doesn't have "autoClose" for
    // `fs.createWriteStream`, we instead have to set this to prevent
    // Node.js from closing the file descriptor
    // TODO this fix might no longer work in future versions of Node.js
    output.closed = true;

    onDrain();
  };
};

exports.write_to_Node = write_to_Node;
var fs_close = function fs_close(fd) {
  return function (action) {
    _fs.close(fd, callback(action));
  };
};

var fs_open = function fs_open(path, flags) {
  return function (action) {
    _fs.open(path, flags, callback(action));
  };
};

var with_fs_open = function with_fs_open(path, flags, f) {
  return _run$_finally$with_resource.with_resource(fs_open(path, flags), f, fs_close);
};

exports.with_fs_open = with_fs_open;
var read_file = function read_file(path, output) {
  return with_fs_open(path, "r", function (fd) {
    return _run$_finally$with_resource._finally(read_from_Node(_fs.createReadStream(null, { encoding: "utf8", fd: fd, autoClose: false }), output),
    // TODO maybe this shouldn't close, but should instead let the caller close it ?
    _push$pull$close.close(output));
  });
};

exports.read_file = read_file;
var write_file = function write_file(input, path) {
  return with_fs_open(path, "w", function (fd) {
    return write_to_Node(input, _fs.createWriteStream(null, { encoding: "utf8", fd: fd }));
  });
};

exports.write_file = write_file;
var rename_file = function rename_file(from, to) {
  return function (action) {
    _fs.rename(from, to, callback(action));
  };
};

exports.rename_file = rename_file;
var symlink = function symlink(from, to) {
  return function (action) {
    _fs.symlink(from, to, callback(action));
  };
};

exports.symlink = symlink;
// TODO is this necessary / useful ?
var real_path = function real_path(path) {
  return function (action) {
    _fs.realpath(path, callback(action));
  };
};

exports.real_path = real_path;
var remove_file = function remove_file(path) {
  return function (action) {
    _fs.unlink(path, callback(action));
  };
};

exports.remove_file = remove_file;
var remove_directory = function remove_directory(path) {
  return function (action) {
    _fs.rmdir(path, callback(action));
  };
};

exports.remove_directory = remove_directory;
// TODO this should probably return something indicating whether the directory
//      already existed or not, or perhaps have another function for that ?
var make_directory = function make_directory(path) {
  return function (action) {
    _fs.mkdir(path, function (err) {
      if (err) {
        if (err.code === "EEXIST") {
          action.success(undefined);
        } else {
          action.error(err);
        }
      } else {
        action.success(undefined);
      }
    });
  };
};

exports.make_directory = make_directory;
var files_from_directory = function files_from_directory(path) {
  return function (action) {
    _fs.readdir(path, callback(action));
  };
};

exports.files_from_directory = files_from_directory;
// TODO is it faster or slower to use `fs.stat` to check for a directory,
//      rather than relying upon the error message ?
var files_from_directory_recursive = function files_from_directory_recursive(file) {
  return function (action) {
    var out = [];

    var pending = 0;

    var terminated = false;

    function loop(files, parent, prefix) {
      pending += files.length;

      files.forEach(function (file) {
        var new_parent = _path.join(parent, file);
        var new_prefix = _path.join(prefix, file);

        _fs.readdir(new_parent, function (err, files) {
          if (err) {
            if (err.code === "ENOTDIR") {
              if (!terminated) {
                out.push(new_prefix);

                --pending;
                if (pending === 0) {
                  action.success(out);
                }
              }
            } else {
              action.error(err);
            }
          } else if (!terminated) {
            --pending;
            loop(files, new_parent, new_prefix);
          }
        });
      });
    }

    _fs.readdir(file, function (err, files) {
      if (err) {
        action.error(err);
      } else if (!terminated) {
        loop(files, file, "");
      }
    });

    action.onTerminate = function () {
      terminated = true;
    };
  };
};
exports.files_from_directory_recursive = files_from_directory_recursive;

},{"../../FFI/Stream":4,"../../FFI/Task":5,"fs":1,"path":2}],8:[function(require,module,exports){
"use strict";

var _toConsumableArray = function (arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } };

Object.defineProperty(exports, "__esModule", {
  value: true
});
// TODO all of these functions generally don't handle trailing slashes correctly

var _path = require("path");

var path = function path(a) {
  return (
    // This only works because Nulan Lists are implemented as JavaScript Arrays
    _path.join.apply(_path, _toConsumableArray(a))
  );
};

exports.path = path;
var normalize_path = function normalize_path(s) {
  return _path.normalize(s);
};

exports.normalize_path = normalize_path;
var absolute_path = function absolute_path(a, s) {
  return (
    // This only works because Nulan Lists are implemented as JavaScript Arrays
    _path.resolve.apply(_path, _toConsumableArray(a).concat([s]))
  );
};

exports.absolute_path = absolute_path;
var is_absolute_path = function is_absolute_path(s) {
  return _path.isAbsolute(s);
};

exports.is_absolute_path = is_absolute_path;
// TODO this has incorrect behavior for, e.g. "/foo/"
// TODO implement Maybe for this
var directory_from_path = function directory_from_path(s, nothing, something) {
  return _path.dirname(s);
};

exports.directory_from_path = directory_from_path;
// TODO this has incorrect behavior for, e.g. "/foo/"
// TODO implement Maybe for this
var file_from_path = function file_from_path(s, nothing, something) {
  return _path.basename(s);
};

exports.file_from_path = file_from_path;
var extension_from_path = function extension_from_path(s, nothing, something) {
  var ext = _path.extname(s);
  if (ext === "") {
    return nothing();
  } else {
    return something(ext);
  }
};

exports.extension_from_path = extension_from_path;
var is_hidden_file = function is_hidden_file(file) {
  return /(^|\/)\./.test(file);
};
exports.is_hidden_file = is_hidden_file;

},{"path":2}],9:[function(require,module,exports){
"use strict";

var _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run = require("../FFI/Task");

var _push$pull$close$stream_fixed = require("../FFI/Stream");

var _read_file$write_file$files_from_directory_recursive = require("../Node.js/FFI/fs");

var _is_hidden_file = require("../Node.js/FFI/path");

var debug = function debug(s, x) {
  console.log(s);
  return x;
};

var _void = function _void() {
  return undefined;
};

var ignore_concurrent = function ignore_concurrent(a) {
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.ignore(_run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.concurrent(a));
};

var stream = function stream() {
  return _push$pull$close$stream_fixed.stream_fixed(5);
};

var forever = (function (_forever) {
  function forever(_x) {
    return _forever.apply(this, arguments);
  }

  forever.toString = function () {
    return _forever.toString();
  };

  return forever;
})(function (task) {
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(task, function (_) {
    return forever(task);
  });
});

var with_stream = function with_stream(task) {
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.on_cancel(_run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.ignore(task), _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.success(_void()));
};

var stream_each = function stream_each(_in, f) {
  return with_stream(forever(_run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(_push$pull$close$stream_fixed.pull(_in), f)));
};

/*const stream_foldl = (init, _in, f) => {
  const next = (old) =>
    // TODO using on_cancel leaks memory, because it's not tail-recursive
    on_cancel(_bind(pull(_in), (value) =>
              _bind(f(old, value), next)),
              success(old));
  return next(init);
};*/

var stream_foldl = function stream_foldl(init, _in, f) {
  var next = (function (_next) {
    function next(_x2) {
      return _next.apply(this, arguments);
    }

    next.toString = function () {
      return _next.toString();
    };

    return next;
  })(function (old) {
    return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(_push$pull$close$stream_fixed.pull(_in), function (value) {
      return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(f(old, value), next);
    });
  });
  return next(init);
};

var copy_file = function copy_file(from, to) {
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(stream(), function (s) {
    return ignore_concurrent([_read_file$write_file$files_from_directory_recursive.read_file(from, s), _read_file$write_file$files_from_directory_recursive.write_file(s, to)]);
  });
};

var current_time = function current_time(task) {
  task.success(Date.now());
};

var benchmark = function benchmark(t) {
  var end = Date.now() + 10000;
  var next = (function (_next2) {
    function next(_x3) {
      return _next2.apply(this, arguments);
    }

    next.toString = function () {
      return _next2.toString();
    };

    return next;
  })(function (i) {
    if (Date.now() < end) {
      return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(t, function (_) {
        return next(i + 1);
      });
    } else {
      return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.success(i);
    }
  });
  return next(0);
};

//////////////////////////////////////////////////////////////////////////////

var generate_add = function generate_add(out) {
  var next = (function (_next3) {
    function next(_x4) {
      return _next3.apply(this, arguments);
    }

    next.toString = function () {
      return _next3.toString();
    };

    return next;
  })(function (i) {
    return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(_push$pull$close$stream_fixed.push(out, i), function (_) {
      return next(i + 1);
    });
  });
  return with_stream(next(0));
};

var generate_multiply = function generate_multiply(out) {
  var next = (function (_next4) {
    function next(_x5) {
      return _next4.apply(this, arguments);
    }

    next.toString = function () {
      return _next4.toString();
    };

    return next;
  })(function (i) {
    return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(_push$pull$close$stream_fixed.push(out, i), function (_) {
      return next(i * 2);
    });
  });
  return with_stream(next(1));
};

/*const accumulate = (_in) =>
  stream_foldl(0, _in, (old, value) => {
    const _new = old + value;
    return _bind(log(_new), (_) => success(_new));
  });*/

var accumulate = function accumulate(_in) {
  return stream_foldl(0, _in, function (old, value) {
    return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.success(old + value);
  });
};

var log_current_time = function log_current_time(max) {
  var next = (function (_next5) {
    function next(_x6) {
      return _next5.apply(this, arguments);
    }

    next.toString = function () {
      return _next5.toString();
    };

    return next;
  })(function (i) {
    if (i < max) {
      return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(current_time, function (now) {
        return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(_run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.log(now), function (_) {
          return next(i + 1);
        });
      });
    } else {
      return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.success(_void());
    }
  });
  return next(0);
};

var increment = (function (_increment) {
  function increment(_x7) {
    return _increment.apply(this, arguments);
  }

  increment.toString = function () {
    return _increment.toString();
  };

  return increment;
})(function (i) {
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run._bind(_run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.log(i), function (_) {
    return increment(i + 1);
  });
});

//////////////////////////////////////////////////////////////////////////////

/*const main = () =>
  success(_void());*/

var main = function main() {
  return forever(_run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.success(5));
};

/*const main = () =>
  _bind(stream_fixed(1), (s) =>
    concurrent([forever(push(s, 1)),
                forever(pull(s))]));*/

/*const main = () =>
  _bind(stream_fixed(1), (s) =>
    _bind(thread(forever(push(s, 1))), (_) =>
      thread(forever(pull(s)))));*/

//const main = () => increment(0);

/*const main = () =>
  fastest([increment(0),
           delay(5000)]);*/

/*const main = () =>
  thread(never());*/

/*const main = () =>
  _bind(benchmark(copy_file("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo")), log);*/

/*const main = () =>
  forever(_bind(current_time, log));*/

/*const main = () =>
  forever(log_current_time(10));*/

/*const main = () =>
  fastest([log_current_time(10),
           success(5)]);*/

/*const t = run(_finally(success(1), success(2)), () => {}, () => {}, () => {});

setTimeout(() => {
  console.log(t._state);
  t.abort(() => {
    console.log(t._state);
  });
}, 2000);*/

//run(ignore(success(10))).terminate();

/*const main = () =>
  _bind(stream_fixed(5), (s) =>
    ignore_concurrent([read_file("/home/pauan/Scratch/2014-09-30", s),
                       stream_each(s, (x) => log(x))]));*/

/*const main = () =>
  copy_file("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo");*/

/*const main = () =>
  _bind(files_from_directory_recursive("/home/pauan/Scratch"), (a) =>
    log(a.filter((x) => !is_hidden_file(x))));*/

/*const main = () =>
  _bind(stream(), (x) =>
    ignore_concurrent([
      generate_add(x),

      generate_multiply(x),

      accumulate(x),

      _bind(delay(1000), (_) =>
        debug("CLOSING", close(x)))
    ]));*/

// browserify --transform babelify Nulan/Examples/Test/Test.js --outfile Nulan/Examples/Test/Test.build.js
_run_root$_bind$_finally$on_cancel$ignore$success$log$never$concurrent$thread$delay$fastest$thread_kill$run.run_root(main);

},{"../FFI/Stream":4,"../FFI/Task":5,"../Node.js/FFI/fs":7,"../Node.js/FFI/path":8}]},{},[9]);
