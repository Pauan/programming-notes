import { Queue, array_remove } from "./Util";


//const promise = Promise.resolve();

const event_queue = new Queue();

const event_queue_flush = () => {
  while (event_queue.length) {
    event_queue.pull()();
  }
};

// TODO is this a good idea ? it's useful for stuff like Streams, but do we want *all* Tasks to behave this way ?
// TODO use the asap polyfill ?
const asap = (f) => {
  //return f();

  //promise["then"](f);

  if (event_queue.length) {
    event_queue.push(f);
  } else {
    event_queue.push(f);
    setTimeout(event_queue_flush, 0);
  }

  /*event_queue["push"](f);

  if (event_queue["length"] === 1) {

  }*/
  //return f();
  //process.nextTick(f);
  //setImmediate(f);
  //setTimeout(f, 0);
};


const print_finished_error = (s) => {
  // TODO code duplication with print_error
  console["error"]("=".repeat(50) + "\n" + s + "\n" + "=".repeat(50));
};

class Task {
  constructor(onSuccess, onError, onCancel) {
    this._pending = true;
    this._onSuccess = onSuccess;
    this._onError = onError;
    this._onCancel = onCancel;
    this.onAbort = null;
  }

  success(value) {
    if (this._pending) {
      const f = this._onSuccess;

      this._pending = false;
      this._onSuccess = null;
      this._onError = null;
      this._onCancel = null;
      this.onAbort = null; // TODO what if somebody sets onAbort after the Task is succeeded ?

      asap(() => f(value));

    } else {
      // TODO if the task is aborted, it probably shouldn't print an error message
      // TODO pretty printing
      print_finished_error("A SUCCESS OCCURRED AFTER THE TASK WAS FINISHED!\n\n" + value);
    }
  }

  error(e) {
    if (this._pending) {
      const f = this._onError;

      this._pending = false;
      this._onSuccess = null;
      this._onError = null;
      this._onCancel = null;
      this.onAbort = null; // TODO what if somebody sets onAbort after the Task is errored ?

      asap(() => f(e));

    // This is to make sure that errors are *never* silently ignored
    } else {
      // TODO code duplication with print_error
      print_finished_error("AN ERROR OCCURRED AFTER THE TASK WAS FINISHED!\n\n" + e["stack"]);
    }
  }

  cancel() {
    if (this._pending) {
      const f = this._onCancel;

      this._pending = false;
      this._onSuccess = null;
      this._onError = null;
      this._onCancel = null;
      this.onAbort = null; // TODO what if somebody sets onAbort after the Task is cancelled ?

      asap(f);

    } else {
      print_finished_error("A CANCEL OCCURRED AFTER THE TASK WAS FINISHED!");
    }
  }

  abort(done) {
    if (this._pending) {
      const f = this.onAbort;

      this._pending = false;
      this._onSuccess = null;
      this._onError = null;
      this._onCancel = null;
      this.onAbort = null; // TODO what if somebody sets onAbort after the Task is aborted ?

      // Some tasks can't be aborted
      if (f !== null) {
        // We cannot use asap for this, or it will potentially cause problems (e.g. _finally)
        f(done);

      } else {
        // We cannot use asap for this, or it will potentially cause problems (e.g. _finally)
        done();
      }

    } else {
      // We cannot use asap for this, or it will potentially cause problems (e.g. _finally)
      done();
    }
  }
}


const PENDING   = 0;
const SUCCEEDED = 1;
const ERRORED   = 2;
const CANCELLED = 3;
const ABORTED   = 4;

class Thread {
  constructor(task) {
    this._state = PENDING;
    this._value = null;
    this._listeners = [];

    this._task = run(task, (value) => {
      if (this._state === PENDING) {
        const a = this._listeners;

        this._state = SUCCEEDED;
        this._value = value;
        this._listeners = null;
        this._task = null;

        // TODO this can be made a bit faster
        a["forEach"]((x) => { x.success(value) });
      }

    }, (e) => {
      if (this._state === PENDING) {
        this._cancel(ERRORED);
        print_error(e);
      }

    }, () => {
      if (this._state === PENDING) {
        this._cancel(CANCELLED);
      }
    });
  }

  _cancel(new_state) {
    const a = this._listeners;

    // TODO verify that _value is null ?
    this._state = new_state;
    this._listeners = null;
    this._task = null;

    // TODO this can be made a bit faster
    a["forEach"]((x) => { x.cancel() });
  }

  wait(task) {
    switch (this._state) {
    case PENDING:
      this._listeners["push"](task);

      // TODO test this
      task.onAbort = (done) => {
        // TODO is it possible for this to be called after `_listeners` is set to `null` ?
        remove_array(this._listeners, task);
        done();
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

  kill(task) {
    switch (this._state) {
    case PENDING:
      const t = this._task;
      const a = this._listeners;

      // TODO verify that _value is null ?
      this._state = ABORTED;
      this._listeners = null;
      this._task = null;

      // TODO this can be made a bit faster
      a["forEach"]((x) => { x.cancel() });

      // TODO should this be before or after cancelling the listeners ?
      t.abort(() => { task.success(undefined) });
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
}


export const noop = () => {};

// There's no standard way to cancel/abort a Promise
export const Task_from_Promise = (f) => (task) => {
  f()["then"]((x) => {
    task.success(x);
  }, (e) => {
    task.error(e);
  });
};

export const Promise_from_Task = (task) =>
  new Promise((resolve, reject) => {
    // TODO is cancellation correctly handled ?
    run(task, resolve, reject, reject);
  });

export const print_error = (e) => {
  console["error"](e["stack"]);
};

export const run = (task, onSuccess, onError, onCancel) => {
  const t = new Task(onSuccess, onError, onCancel);
  task(t);
  return t;
};

export const run_root = (task) => {
  run(task, noop, print_error, noop);
};

// This can be implemented purely with `execute`,
// but it's faster to implement it like this
export const success = (x) => (task) => {
  task.success(x);
};

export const error = (s) => {
  // TODO better stack traces
  const e = new Error(s);
  return (task) => {
    task.error(e);
  };
};

export const cancel = () => (task) => {
  task.cancel();
};

export const never = () => (task) => {};

export const _bind = (x, f) => (task) => {
  const error = (e) => {
    task.error(e);
  };

  const cancel = () => {
    task.cancel();
  };

  const t1 = run(x, (value) => {
    const t2 = run(f(value), (value) => {
      task.success(value);
    }, error, cancel);

    task.onAbort = (done) => {
      t2.abort(done);
    };
  }, error, cancel);

  task.onAbort = (done) => {
    t1.abort(done);
  };
};

export const _finally = (before, after) => (task) => {
  let aborted = false;

  const error = (e) => {
    task.error(e);
  };

  const cancel = () => {
    task.cancel();
  };

  const t1 = run(before, (value) => {
    if (!aborted) {
      // This task is run no matter what, even if it is aborted
      run(after, (_) => {
        task.success(value);
      }, error, cancel);
    }

  }, (e) => {
    if (!aborted) {
      // Errors have precedence over cancellations
      const propagate = () => {
        task.error(e);
      };

      // This task is run no matter what, even if it is aborted
      run(after, propagate, error, propagate);
    }

  }, () => {
    if (!aborted) {
      // This task is run no matter what, even if it is aborted
      run(after, cancel, error, cancel);
    }
  });

  task.onAbort = (done) => {
    aborted = true;

    t1.abort(() => {
      // This task is run no matter what, even if it is aborted
      // Because the task was aborted, there's no point in returning anything
      run(after, (_) => {
        done();

      }, (e) => {
        task.error(e);
        done();

      }, done);
    });
  };
};

export const on_cancel = (x, y) => (task) => {
  const success = (value) => {
    task.success(value);
  };

  const error = (e) => {
    task.error(e);
  };

  const t1 = run(x, success, error, () => {
    const t2 = run(y, success, error, () => {
      task.cancel();
    });

    // TODO should this abort ?
    task.onAbort = (done) => {
      t2.abort(done);
    };
  });

  task.onAbort = (done) => {
    t1.abort(done);
  };
};

export const execute = (f) => (task) => {
  try {
    task.success(f());
  } catch (e) {
    task.error(e);
  }
};

// This can be implemented purely with bind + wrap,
// but it's more efficient to implement it with the FFI
export const ignore = (x) => (task) => {
  const t = run(x, (_) => {
    task.success(undefined);

  }, (e) => {
    task.error(e);

  }, () => {
    task.cancel();
  });

  task.onAbort = (done) => {
    t.abort(done);
  };
};

export const thread = (x) => (task) => {
  // TODO should this use nextTick or something ?
  task.success(new Thread(x));
};

export const thread_wait = (x) => (task) => {
  // TODO should this use nextTick or something ?
  x.wait(task);
};

export const thread_kill = (x) => (task) => {
  // TODO should this use nextTick or something ?
  x.kill();
  task.success(undefined);
};

export const abortAll = (tasks, done) => {
  let pending = tasks["length"];

  // TODO is it faster to use a var or a let ?
  for (let i = 0; i < tasks["length"]; ++i) {
    tasks[i].abort(() => {
      --pending;
      if (pending === 0) {
        done();
      }
    });
  }
};

// TODO verify that this works correctly in all situations
export const concurrent = (a) => (task) => {
  const out = new Array(a["length"]);

  const tasks = [];

  let pending = a["length"];

  let failed = false;

  const onSuccess = () => {
    if (!failed) {
      --pending;
      if (pending === 0) {
        task.success(out);
      }
    }
  };

  const onError = (e) => {
    // Always emit all the errors
    // The error that is emitted first is non-deterministic
    failed = true;
    abortAll(tasks, () => {
      task.error(e);
    });
  };

  const onCancel = () => {
    if (!failed) {
      failed = true;
      abortAll(tasks, () => {
        task.cancel();
      });
    }
  };

  for (let i = 0; i < a["length"]; ++i) {
    // TODO this probably isn't needed anymore, but keep it just in case ?
    if (failed) {
      break;

    } else {
      const t = run(a[i], (value) => {
        out[i] = value;
        onSuccess();
      }, onError, onCancel);

      tasks["push"](t);
    }
  }

  task.onAbort = (done) => {
    // TODO is this correct ?
    if (failed) {
      done();

    } else {
      failed = true;
      abortAll(tasks, done);
    }
  };
};

// TODO verify that this works correctly in all situations
export const race = (a) => (task) => {
  const tasks = [];

  let done = false;

  const onSuccess = (value) => {
    if (!done) {
      done = true;
      abortAll(tasks, () => {
        task.success(value);
      });
    }
  };

  const onError = (e) => {
    // Always emit all the errors
    // The error that is emitted first is non-deterministic
    done = true;
    abortAll(tasks, () => {
      task.error(e);
    });
  };

  // TODO should it only cancel if all the tasks fail ?
  const onCancel = () => {
    if (!done) {
      done = true;
      abortAll(tasks, () => {
        task.cancel();
      });
    }
  };

  // TODO is it faster to use var or let ?
  for (let i = 0; i < a["length"]; ++i) {
    // TODO this probably isn't needed anymore, but keep it just in case ?
    if (done) {
      break;

    } else {
      tasks["push"](run(a[i], onSuccess, onError, onCancel));
    }
  }

  task.onAbort = (f) => {
    // TODO is this correct ?
    if (done) {
      f();

    } else {
      done = true;
      abortAll(tasks, f);
    }
  };
};


// Often-used functionality
export const delay = (ms) => (task) => {
  const timer = setTimeout(() => {
    task.success(undefined);
  }, ms);

  task.onAbort = (done) => {
    clearTimeout(timer);
    done();
  };
};

export const log = (s) => (task) => {
  console["log"](s);
  task.success(undefined);
};
