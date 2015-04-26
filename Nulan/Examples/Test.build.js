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

var closed_peek = function closed_peek(task) {
  if (this._buffer.length) {
    task.success(this._buffer.peek());
  } else {
    task.cancel();
  }
};

var closed_pull = function closed_pull(task) {
  if (this._buffer.length) {
    task.success(this._buffer.pull());
  } else {
    task.cancel();
  }
};

var closed_push = function closed_push(task, value) {
  task.cancel();
};

var closed_close = function closed_close(task) {
  // TODO is this correct ? maybe it should simply do nothing if you close a Stream multiple times
  task.error(new Error("Cannot close: stream is already closed"));
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
        a[i].task.cancel();
      }
    }
  }, {
    key: "close",
    value: function close(task) {
      this.peek = closed_peek;
      this.pull = closed_pull;
      this.push = closed_push;
      this.close = closed_close;

      // TODO is this executed in the right order ?
      this.cleanup();

      // TODO should this cancel ?
      task.success(undefined);
    }
  }, {
    key: "peek",
    value: function peek(task) {
      var _this = this;

      if (this._buffer.length) {
        task.success(this._buffer.peek());
      } else {
        (function () {
          var info = {
            push: true,
            task: task
          };

          _this._pullers.push(info);

          task.onAbort = function () {
            // TODO is it possible for `this._pullers` to be `null` ?
            remove_array(_this._pullers, info);
          };
        })();
      }
    }
  }, {
    key: "pull",
    value: function pull(task) {
      var _this2 = this;

      if (this._buffer.length) {
        task.success(this._buffer.pull());
      } else {
        (function () {
          var info = {
            push: false,
            task: task
          };

          _this2._pullers.push(info);

          task.onAbort = function () {
            // TODO is it possible for `this._pullers` to be `null` ?
            remove_array(_this2._pullers, info);
          };
        })();
      }
    }
  }, {
    key: "push",
    value: function push(task, value) {
      // If there is a pending pull
      if (this._pullers.length) {
        var f = this._pullers.shift();

        if (f.push) {
          this._buffer.push(value);
        }

        f.task.success(value);
        task.success(undefined);

        // If there is room in the buffer
      } else if (this._buffer.length < this._limit) {
        this._buffer.push(value);
        task.success(undefined);

        // Buffer is full
      } else {
        this.full(task, value);
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
        a[i].task.cancel();
      }
    }
  }, {
    key: "pull",
    value: function pull(task) {
      var _this3 = this;

      // If there is stuff in the buffer
      if (this._buffer.length) {
        var value = this._buffer.pull();

        // If there is a pending push
        if (this._pushers.length) {
          var f = this._pushers.shift();
          this._buffer.push(f.value);
          f.task.success(undefined);
        }

        task.success(value);

        // Buffer is empty, wait for push
      } else {
        (function () {
          var info = {
            push: false,
            task: task
          };

          _this3._pullers.push(info);

          task.onAbort = function () {
            // TODO is it possible for `this._pullers` to be `null` ?
            _Queue$array_remove.array_remove(_this3._pullers, info);
          };
        })();
      }
    }
  }, {
    key: "full",
    value: function full(task, value) {
      var _this4 = this;

      var info = {
        value: value,
        task: task
      };

      this._pushers.push(info);

      task.onAbort = function () {
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
    value: function full(task, value) {
      // TODO more efficient function for this
      this._buffer.pull();
      this._buffer.push(value);
      task.success(undefined);
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
    value: function full(task, value) {
      task.success(undefined);
    }
  }]);

  return StreamDropping;
})(StreamBase);

var stream_fixed = function stream_fixed(i) {
  return function (task) {
    if (check_length(i)) {
      task.success(new StreamFixed(i));
    }
  };
};

exports.stream_fixed = stream_fixed;
var stream_sliding = function stream_sliding(i) {
  return function (task) {
    if (check_length(i)) {
      task.success(new StreamSliding(i));
    }
  };
};

exports.stream_sliding = stream_sliding;
var stream_dropping = function stream_dropping(i) {
  return function (task) {
    if (check_length(i)) {
      task.success(new StreamDropping(i));
    }
  };
};

exports.stream_dropping = stream_dropping;
var peek = function peek(stream) {
  return function (task) {
    stream.peek(task);
  };
};

exports.peek = peek;
var pull = function pull(stream) {
  return function (task) {
    stream.pull(task);
  };
};

exports.pull = pull;
var push = function push(stream, value) {
  return function (task) {
    stream.push(task, value);
  };
};

exports.push = push;
var close = function close(stream) {
  return function (task) {
    stream.close(task);
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

var _Queue$array_remove$nextTick = require("./Util");

var print_fatal = function print_fatal(s) {
  // TODO code duplication with print_error
  console.error("=".repeat(50) + "\n" + s + "\n" + "=".repeat(50));
};

var print_finished_error = function print_finished_error(e) {
  // TODO code duplication with print_error
  print_fatal("AN ERROR OCCURRED AFTER THE TASK WAS FINISHED!\n\n" + e.stack);
};

//const promise = Promise.resolve();

var event_queue = new _Queue$array_remove$nextTick.Queue();

// For Node.js only
if (typeof process === "object" && typeof process.on === "function") {
  process.on("uncaughtException", function (e) {
    print_fatal("AN UNCAUGHT ERROR OCCURRED!\n\n" + e.stack);
    process.exit(1);
  });

  // TODO this doesn't seem to work
  process.on("beforeExit", function () {
    console.log("beforeExit");
  });

  process.on("exit", function () {
    if (RUNNING_TASKS !== 0) {
      print_fatal("NODE.JS IS EXITING, BUT THERE ARE STILL " + RUNNING_TASKS + " TASKS PENDING!");
    }
  });
}

var event_queue_flush = function event_queue_flush() {
  while (event_queue.length) {
    event_queue.pull()();
  }
};

// TODO is this a good idea ? it's useful for stuff like Streams, but do we want *all* Tasks to behave this way ?
// TODO use the asap polyfill ?
var asap = function asap(f) {
  //return f();

  //promise["then"](f);

  if (event_queue.length === 0) {
    event_queue.push(f);
    _Queue$array_remove$nextTick.nextTick(event_queue_flush);
  } else {
    event_queue.push(f);
  }

  /*event_queue["push"](f);
   if (event_queue["length"] === 1) {
   }*/
  //return f();
  //process.nextTick(f);
  //setImmediate(f);
  //setTimeout(f, 0);
};

var RUNNING_TASKS = 0;

var PENDING = 0;
var SUCCEEDED = 1;
var ERRORED = 2;
var CANCELLED = 3;
var ABORTED = 4;

var Task = (function () {
  function Task(onSuccess, onError, onCancel) {
    _classCallCheck(this, Task);

    // TODO is a simple boolean `_pending` sufficient ?
    // TODO is it faster or slower to use (`_pending` and `if`) or (`_state` and `switch`) ?
    this._state = PENDING;

    // When a task's state is no longer pending, exactly 1 of these 4
    // callbacks will be called, and it will only be called once.
    this._onSuccess = onSuccess;
    this._onError = onError;
    this._onCancel = onCancel;
    this.onAbort = null;

    ++RUNNING_TASKS;
  }

  _createClass(Task, [{
    key: "success",
    value: function success(value) {
      var _this = this;

      if (this._state === PENDING) {
        (function () {
          var f = _this._onSuccess;

          _this._state = SUCCEEDED;
          _this._onSuccess = null;
          _this._onError = null;
          _this._onCancel = null;
          _this.onAbort = null; // TODO what if somebody sets onAbort after the Task is succeeded ?

          asap(function () {
            f(value);
            --RUNNING_TASKS; // TODO is this correct ?
          });

          // It's okay for a Task to succeed after an abort
          // TODO we should only allow `success` to be called once, even after an abort
        })();
      } else if (this._state !== ABORTED) {
        // TODO if the task is aborted, should it *not* print an error message ?
        // TODO pretty printing for value
        print_fatal("A SUCCESS OCCURRED AFTER THE TASK WAS FINISHED!\n\n" + value);
      }
    }
  }, {
    key: "error",
    value: function error(e) {
      var _this2 = this;

      if (this._state === PENDING) {
        (function () {
          var f = _this2._onError;

          _this2._state = ERRORED;
          _this2._onSuccess = null;
          _this2._onError = null;
          _this2._onCancel = null;
          _this2.onAbort = null; // TODO what if somebody sets onAbort after the Task is errored ?

          asap(function () {
            f(e);
            --RUNNING_TASKS; // TODO is this correct ?
          });
        })();
      } else {
        // This is to make sure that errors are *never* silently ignored
        print_finished_error(e);
      }
    }
  }, {
    key: "cancel",
    value: function cancel() {
      var _this3 = this;

      if (this._state === PENDING) {
        (function () {
          var f = _this3._onCancel;

          _this3._state = CANCELLED;
          _this3._onSuccess = null;
          _this3._onError = null;
          _this3._onCancel = null;
          _this3.onAbort = null; // TODO what if somebody sets onAbort after the Task is cancelled ?

          asap(function () {
            f();
            --RUNNING_TASKS; // TODO is this correct ?
          });

          // TODO should it be okay for a task to cancel after an abort ?
        })();
      } else {
        print_fatal("A CANCEL OCCURRED AFTER THE TASK WAS FINISHED!");
      }
    }
  }, {
    key: "abort",
    value: function abort() {
      if (this._state === PENDING) {
        var f = this.onAbort;

        this._state = ABORTED;
        this._onSuccess = null;
        this._onError = null;
        this._onCancel = null;
        this.onAbort = null; // TODO what if somebody sets onAbort after the Task is aborted ?

        // Some tasks can't be aborted
        if (f !== null) {
          // This can't use asap (see e.g._bind and _finally)
          f();
        }

        --RUNNING_TASKS; // TODO is this correct ?
        return true;
      } else if (this._state === ABORTED) {
        // TODO maybe use this.error instead ?
        print_fatal("YOU CANNOT ABORT THE SAME TASK TWICE!");
        return false;
      } else {
        return false;
      }
    }
  }]);

  return Task;
})();

var Thread = (function () {
  function Thread(task) {
    var _this4 = this;

    _classCallCheck(this, Thread);

    this._state = PENDING;
    this._value = null;
    this._listeners = [];

    this._task = run(task, function (value) {
      if (_this4._state === PENDING) {
        var _a = _this4._listeners;

        _this4._state = SUCCEEDED;
        _this4._value = value;
        _this4._listeners = null;
        _this4._task = null;

        // TODO this can be made a bit faster
        _a.forEach(function (x) {
          x.success(value);
        });
      }
    }, function (e) {
      if (_this4._state === PENDING) {
        _this4._cancel(ERRORED);
        print_error(e);
      }
    }, function () {
      if (_this4._state === PENDING) {
        _this4._cancel(CANCELLED);
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
      this._task = null;

      // TODO this can be made a bit faster
      a.forEach(function (x) {
        x.cancel();
      });
    }
  }, {
    key: "wait",
    value: function wait(task) {
      var _this5 = this;

      switch (this._state) {
        case PENDING:
          this._listeners.push(task);

          // TODO test this
          task.onAbort = function () {
            remove_array(_this5._listeners, task);
          };
          break;

        case SUCCESS:
          task.success(this._value);
          break;

        // TODO is this correct ?
        case CANCELLED:
        case ERRORED:
        case ABORTED:
          task.cancel();
          break;
      }
    }
  }, {
    key: "kill",
    value: function kill(task) {
      switch (this._state) {
        case PENDING:
          var t = this._task;
          var a = this._listeners;

          // TODO verify that _value is null ?
          this._state = ABORTED;
          this._listeners = null;
          this._task = null;

          // TODO this can be made a bit faster
          a.forEach(function (x) {
            x.cancel();
          });

          // TODO should this be before or after cancelling the listeners ?
          t.abort();
          task.success(undefined);
          break;

        // TODO is this correct ?
        case SUCCESS:
        case ERRORED:
        case CANCELLED:
          task.success(undefined);
          break;

        case ABORTED:
          task.error(new Error("Cannot kill thread: thread is already killed"));
          break;
      }
    }
  }]);

  return Thread;
})();

var noop = function noop() {};

exports.noop = noop;
// There's no standard way to cancel/abort a Promise
var Task_from_Promise = function Task_from_Promise(f) {
  return function (task) {
    f().then(function (x) {
      task.success(x);
    }, function (e) {
      task.error(e);
    });
  };
};

exports.Task_from_Promise = Task_from_Promise;
// TODO how to handle the task/promise being aborted ?
var Promise_from_Task = function Promise_from_Task(t) {
  return new Promise(function (resolve, reject) {
    // TODO is cancellation correctly handled ?
    run(t, resolve, reject, reject);
  });
};

exports.Promise_from_Task = Promise_from_Task;
var print_error = function print_error(e) {
  console.error(e.stack);
};

exports.print_error = print_error;
var run = function run(task, onSuccess, onError, onCancel) {
  var t = new Task(onSuccess, onError, onCancel);
  // TODO maybe use try/catch here ?
  task(t);
  return t;
};

exports.run = run;
// TODO does this work properly in all platforms ?
var MAX_TIMER = Math.pow(2, 31) - 1;

// TODO test this
var block = function block() {
  // This is necessary to prevent Node.js from exiting before the tasks are complete
  // TODO is there a more efficient way to do this ?
  // TODO maybe only do this on Node.js ?
  // TODO maybe provide a way to disable this ?
  // TODO test this
  var timer = setInterval(function () {}, MAX_TIMER);

  return function (task) {
    clearInterval(timer);
    task.success(undefined);
  };
};

exports.block = block;
var run_root = function run_root(f) {
  // TODO maybe use `execute`, rather than `try/catch` ?
  // TODO is it necessary to use try/catch ?
  try {
    // TODO is it inefficient to use _finally here ?
    run(_finally(f(), block()), noop, print_error, noop);
  } catch (e) {
    print_error(e);
  }
};

exports.run_root = run_root;
// This can be implemented purely with `execute`,
// but it's faster to implement it like this
var success = function success(x) {
  return function (task) {
    task.success(x);
  };
};

exports.success = success;
var error = function error(s) {
  // TODO better stack traces
  var e = new Error(s);
  return function (task) {
    task.error(e);
  };
};

exports.error = error;
var cancel = function cancel() {
  return function (task) {
    task.cancel();
  };
};

exports.cancel = cancel;
// TODO what if the task is aborted ?
var never = function never() {
  return function (task) {};
};

exports.never = never;
var _bind = function _bind(x, f) {
  return function (task) {
    var aborted = false;

    var success = function success(value) {
      task.success(value);
    };

    var error = function error(e) {
      task.error(e);
    };

    var cancel = function cancel() {
      task.cancel();
    };

    var t1 = run(x, function (value) {
      if (!aborted) {
        (function () {
          var t2 = run(f(value), success, error, cancel);

          // TODO is it even possible for this to occur ?
          task.onAbort = function () {
            t2.abort();
          };
        })();
      }
    }, error, cancel);

    task.onAbort = function () {
      aborted = true;
      t1.abort();
    };
  };
};

exports._bind = _bind;
// TODO test this
var with_resource = function with_resource(before, during, after) {
  return function (task) {
    var aborted = false;

    var success = function success(value) {
      task.success(value);
    };

    var error = function error(e) {
      task.error(e);
    };

    var cancel = function cancel() {
      task.cancel();
    };

    // This is always run, even if it's aborted
    run(before, function (value) {
      if (aborted) {
        // This is always run, even if it's aborted
        run(after(value), success, error, cancel);
      } else {
        // There's no need to create a new task for this, so we just use the existing one
        _finally(during(value), after(value))(task);
      }
    }, error, cancel);

    task.onAbort = function () {
      aborted = true;
    };
  };
};

exports.with_resource = with_resource;
var _finally = function _finally(before, after) {
  return function (task) {
    var error = function error(e) {
      task.error(e);
    };

    var cancel = function cancel() {
      task.cancel();
    };

    var t = run(before, function (value) {
      // This task is run no matter what, even if it is aborted
      run(after, function (_) {
        task.success(value);
      }, error, cancel);
    }, function (e) {
      // Errors have precedence over cancellations
      var propagate = function propagate() {
        task.error(e);
      };

      // This task is run no matter what, even if it is aborted
      run(after, propagate, error, propagate);
    }, function () {
      // This task is run no matter what, even if it is aborted
      run(after, cancel, error, cancel);
    });

    task.onAbort = function () {
      if (t.abort()) {
        // This task is run no matter what, even if it is aborted
        // There's nothing to return, so we use `noop`
        run(after, noop, error, cancel);
      }
    };
  };
};

exports._finally = _finally;
var on_cancel = function on_cancel(x, y) {
  return function (task) {
    var aborted = false;

    var success = function success(value) {
      task.success(value);
    };

    var error = function error(e) {
      task.error(e);
    };

    var t1 = run(x, success, error, function () {
      // TODO maybe this should execute even if it was aborted ?
      if (!aborted) {
        (function () {
          var t2 = run(y, success, error, function () {
            task.cancel();
          });

          // TODO should this abort ?
          task.onAbort = function () {
            t2.abort();
          };
        })();
      }
    });

    task.onAbort = function () {
      aborted = true;
      t1.abort();
    };
  };
};

exports.on_cancel = on_cancel;
var execute = function execute(f) {
  return function (task) {
    try {
      task.success(f());
    } catch (e) {
      task.error(e);
    }
  };
};

exports.execute = execute;
// This can be implemented purely with bind + wrap,
// but it's more efficient to implement it with the FFI
var ignore = function ignore(x) {
  return function (task) {
    var t = run(x, function (_) {
      task.success(undefined);
    }, function (e) {
      task.error(e);
    }, function () {
      task.cancel();
    });

    task.onAbort = function () {
      t.abort();
    };
  };
};

exports.ignore = ignore;
var thread = function thread(x) {
  return function (task) {
    task.success(new Thread(x));
  };
};

exports.thread = thread;
var thread_wait = function thread_wait(x) {
  return function (task) {
    x.wait(task);
  };
};

exports.thread_wait = thread_wait;
var thread_kill = function thread_kill(x) {
  return function (task) {
    x.kill(task);
  };
};

exports.thread_kill = thread_kill;
var abortAll = function abortAll(tasks) {
  // TODO is it faster to use a var or a let ?
  for (var i = 0; i < tasks.length; ++i) {
    tasks[i].abort();
  }
};

exports.abortAll = abortAll;
// TODO verify that this works correctly in all situations
var concurrent = function concurrent(a) {
  return function (task) {
    var out = new Array(a.length);

    var tasks = [];

    var pending = a.length;

    var failed = false;

    var onAbort = function onAbort() {
      if (!failed) {
        failed = true;
        abortAll(tasks);
      }
    };

    var onSuccess = function onSuccess() {
      if (!failed) {
        --pending;
        if (pending === 0) {
          task.success(out);
        }
      }
    };

    var onError = function onError(e) {
      onAbort();
      // Always emit all the errors
      // The error that is emitted first is non-deterministic
      task.error(e);
    };

    var onCancel = function onCancel() {
      onAbort();
      task.cancel();
    };

    var _loop = function (i) {
      // TODO test that this is always called asynchronously
      var t = run(a[i], function (value) {
        out[i] = value;
        onSuccess();
      }, onError, onCancel);

      tasks.push(t);
    };

    for (var i = 0; i < a.length; ++i) {
      _loop(i);
    }

    task.onAbort = onAbort;
  };
};

exports.concurrent = concurrent;
// TODO verify that this works correctly in all situations
var race = function race(a) {
  return function (task) {
    var tasks = [];

    var done = false;

    var onAbort = function onAbort() {
      if (!done) {
        done = true;
        abortAll(tasks);
      }
    };

    var onSuccess = function onSuccess(value) {
      onAbort();
      task.success(value);
    };

    var onError = function onError(e) {
      onAbort();
      // Always emit all the errors
      // The error that is emitted first is non-deterministic
      task.error(e);
    };

    // TODO should it only cancel if all the tasks fail ?
    var onCancel = function onCancel() {
      onAbort();
      task.cancel();
    };

    // TODO is it faster to use var or let ?
    for (var i = 0; i < a.length; ++i) {
      // TODO test that this is always called asynchronously
      tasks.push(run(a[i], onSuccess, onError, onCancel));
    }

    task.onAbort = onAbort;
  };
};

exports.race = race;
// Often-used functionality
var delay = function delay(ms) {
  return function (task) {
    var timer = setTimeout(function () {
      task.success(undefined);
    }, ms);

    task.onAbort = function () {
      clearTimeout(timer);
    };
  };
};

exports.delay = delay;
var log = function log(s) {
  return function (task) {
    console.log(s);
    task.success(undefined);
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
      ++this.length;

      if (this._left.length) {
        this._right.push(value);
      } else {
        this._left.push(value);
      }
    }
  }, {
    key: "pull",
    value: function pull() {
      --this.length;

      var left = this._left;

      var value = left.pop();

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
var nextTick = function nextTick(f) {
  // Because we're using `event_queue`, we avoid the 4ms penalty of `setTimeout`.
  // We could also use something like `setImmediate`, but that's not cross-platform.
  // TODO use MutationObserver, setImmediate, nextTick, etc. if they're available
  setTimeout(f, 0);
};
exports.nextTick = nextTick;

},{}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _push$pull$close = require("../../FFI/Stream");

// "nulan:Stream"

var _bind$run$_finally = require("../../FFI/Task");

// "nulan:Task"

var _fs = require("fs");
var _path = require("path");

var callback = function callback(task) {
  return function (err, value) {
    if (err) {
      task.error(err);
    } else {
      task.success(value);
    }
  };
};

exports.callback = callback;
var read_from_Node = function read_from_Node(input, output) {
  return function (task) {
    var finished = false;

    var cleanup = function cleanup() {
      if (!finished) {
        finished = true;
        input.removeListener("end", onEnd);
        input.removeListener("error", onError);
        input.removeListener("readable", onReadable);
      }
    };

    task.onAbort = function () {
      cleanup();
    };

    var onEnd = function onEnd() {
      cleanup();
      task.success(undefined);
    };

    var onError = function onError(e) {
      cleanup();
      task.error(e);
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
            var t = _bind$run$_finally.run(_push$pull$close.push(output, chunk), onReadable, onError, onEnd);

            task.onAbort = function () {
              cleanup();
              t.abort();
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
  return function (task) {
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

    task.onAbort = function () {
      cleanup();
    };

    // TODO is this correct? maybe get rid of the "finish" event entirely ?
    var onFinish = function onFinish() {
      cleanup();
      task.error(new Error("This should never happen"));
    };

    var onCancel = function onCancel() {
      cleanup();
      task.success(undefined);
    };

    var onError = function onError(e) {
      cleanup();
      task.error(e);
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
          var t = _bind$run$_finally.run(_push$pull$close.pull(input), onSuccess, onError, onCancel);

          task.onAbort = function () {
            cleanup();
            t.abort();
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
  return function (task) {
    _fs.close(fd, callback(task));
  };
};

var fs_open = function fs_open(path, flags) {
  return function (task) {
    _fs.open(path, flags, callback(task));
  };
};

var with_fs_open = function with_fs_open(path, flags, f) {
  return with_resource(fs_open(path, flags), f, fs_close);
};

exports.with_fs_open = with_fs_open;
var read_file = function read_file(path, output) {
  return with_fs_open(path, "r", function (fd) {
    return _bind$run$_finally._finally(read_from_Node(_fs.createReadStream(null, { encoding: "utf8", fd: fd, autoClose: false }), output),
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
  return function (task) {
    _fs.rename(from, to, callback(task));
  };
};

exports.rename_file = rename_file;
var symlink = function symlink(from, to) {
  return function (task) {
    _fs.symlink(from, to, callback(task));
  };
};

exports.symlink = symlink;
// TODO is this necessary / useful ?
var real_path = function real_path(path) {
  return function (task) {
    _fs.realpath(path, callback(task));
  };
};

exports.real_path = real_path;
var remove_file = function remove_file(path) {
  return function (task) {
    _fs.unlink(path, callback(task));
  };
};

exports.remove_file = remove_file;
var remove_directory = function remove_directory(path) {
  return function (task) {
    _fs.rmdir(path, callback(task));
  };
};

exports.remove_directory = remove_directory;
// TODO this should probably return something indicating whether the directory
//      already existed or not, or perhaps have another function for that ?
var make_directory = function make_directory(path) {
  return function (task) {
    _fs.mkdir(path, function (err) {
      if (err) {
        if (err.code === "EEXIST") {
          task.success(undefined);
        } else {
          task.error(err);
        }
      } else {
        task.success(undefined);
      }
    });
  };
};

exports.make_directory = make_directory;
var files_from_directory = function files_from_directory(path) {
  return function (task) {
    _fs.readdir(path, callback(task));
  };
};

exports.files_from_directory = files_from_directory;
// TODO is it faster or slower to use `fs.stat` to check for a directory,
//      rather than relying upon the error message ?
var files_from_directory_recursive = function files_from_directory_recursive(file) {
  return function (task) {
    var out = [];

    var pending = 0;

    var aborted = false;

    function loop(files, parent, prefix) {
      pending += files.length;

      files.forEach(function (file) {
        var new_parent = _path.join(parent, file);
        var new_prefix = _path.join(prefix, file);

        _fs.readdir(new_parent, function (err, files) {
          if (err) {
            if (err.code === "ENOTDIR") {
              if (!aborted) {
                out.push(new_prefix);

                --pending;
                if (pending === 0) {
                  task.success(out);
                }
              }
            } else {
              task.error(err);
            }
          } else if (!aborted) {
            --pending;
            loop(files, new_parent, new_prefix);
          }
        });
      });
    }

    _fs.readdir(file, function (err, files) {
      if (err) {
        task.error(err);
      } else if (!aborted) {
        loop(files, file, "");
      }
    });

    task.onAbort = function () {
      aborted = true;
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

var _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run = require("./FFI/Task");

var _push$pull$close$stream_fixed = require("./FFI/Stream");

var _read_file$write_file$files_from_directory_recursive = require("./Node.js/FFI/fs");

var _is_hidden_file = require("./Node.js/FFI/path");

var debug = function debug(s, x) {
  console.log(s);
  return x;
};

var _void = function _void() {
  return undefined;
};

var ignore_concurrent = function ignore_concurrent(a) {
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.ignore(_run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.concurrent(a));
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
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(task, function (_) {
    return forever(task);
  });
});

var with_stream = function with_stream(task) {
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.on_cancel(_run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.ignore(task), _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.success(_void()));
};

var stream_each = function stream_each(_in, f) {
  return with_stream(forever(_run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(_push$pull$close$stream_fixed.pull(_in), f)));
};

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
    return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.on_cancel(_run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(_push$pull$close$stream_fixed.pull(_in), function (value) {
      return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(f(old, value), next);
    }), _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.success(old));
  });
  return next(init);
};

var copy_file = function copy_file(from, to) {
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(stream(), function (s) {
    return ignore_concurrent([_read_file$write_file$files_from_directory_recursive.read_file(from, s), _read_file$write_file$files_from_directory_recursive.write_file(s, to)]);
  });
};

var current_time = function current_time(task) {
  return task.success(Date.now());
};

//////////////////////////////////////////////////////////////////////////////

var generate_add = function generate_add(out) {
  var next = (function (_next2) {
    function next(_x3) {
      return _next2.apply(this, arguments);
    }

    next.toString = function () {
      return _next2.toString();
    };

    return next;
  })(function (i) {
    return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(_push$pull$close$stream_fixed.push(out, i), function (_) {
      return next(i + 1);
    });
  });
  return with_stream(next(0));
};

var generate_multiply = function generate_multiply(out) {
  var next = (function (_next3) {
    function next(_x4) {
      return _next3.apply(this, arguments);
    }

    next.toString = function () {
      return _next3.toString();
    };

    return next;
  })(function (i) {
    return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(_push$pull$close$stream_fixed.push(out, i), function (_) {
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
    return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.success(old + value);
  });
};

var log_current_time = function log_current_time(max) {
  var next = (function (_next4) {
    function next(_x5) {
      return _next4.apply(this, arguments);
    }

    next.toString = function () {
      return _next4.toString();
    };

    return next;
  })(function (i) {
    if (i < max) {
      return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(current_time, function (now) {
        return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(_run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.log(now), function (_) {
          return next(i + 1);
        });
      });
    } else {
      return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.success(_void());
    }
  });
  return next(0);
};

//////////////////////////////////////////////////////////////////////////////

/*const main = () =>
  success(_void());*/

/*const main = () =>
  forever(success(5));*/

var main = function main() {
  return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run._bind(_push$pull$close$stream_fixed.stream_fixed(1), function (s) {
    return _run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.concurrent([forever(_push$pull$close$stream_fixed.push(s, 1)), forever(_push$pull$close$stream_fixed.pull(s))]);
  });
};

/*const main = () =>
  _bind(stream_fixed(1), (s) =>
    _bind(thread(forever(push(s, 1))), (_) =>
      thread(forever(pull(s)))));*/

/*const main = () =>
  race([forever(_bind(current_time, log)),
        _bind(delay(1000), (_) =>
          log("done"))]);*/

/*const main = () =>
  race([log_current_time(10),
        success(5)]);*/

/*const t = run(_finally(success(1), success(2)), () => {}, () => {}, () => {});

setTimeout(() => {
  console.log(t._state);
  t.abort(() => {
    console.log(t._state);
  });
}, 2000);*/

/*run(ignore(success(10))).abort(() => {
  console.log("DONE");
});*/

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

      //accumulate(x),

      _bind(delay(1000), (_) =>
        debug("CLOSING", close(x)))
    ]));*/

// browserify --transform babelify Nulan/Examples/Test.js --outfile Nulan/Examples/Test.build.js
_run_root$_bind$_finally$on_cancel$ignore$success$log$concurrent$thread$delay$race$thread_kill$run.run_root(main);

},{"./FFI/Stream":4,"./FFI/Task":5,"./Node.js/FFI/fs":7,"./Node.js/FFI/path":8}]},{},[9]);
