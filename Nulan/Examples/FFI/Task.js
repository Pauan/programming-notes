import { Queue, array_remove, nextTick } from "./Util";


const print_fatal = (s) => {
  // TODO code duplication with print_error
  console["error"]("="["repeat"](50) + "\n" + s + "\n" + "="["repeat"](50));
};

const print_finished_error = (e) => {
  // TODO code duplication with print_error
  print_fatal("AN ERROR OCCURRED AFTER THE TASK WAS FINISHED!\n\n" + e["stack"]);
};


//const promise = Promise.resolve();


// For Node.js only
if (typeof process === "object" && typeof process["on"] === "function") {
  process["on"]("uncaughtException", (e) => {
    print_fatal("AN UNCAUGHT ERROR OCCURRED!\n\n" + e["stack"]);
    process["exit"](1);
  });

  // TODO this doesn't seem to work
  process["on"]("beforeExit", () => {
    console["log"]("beforeExit");
  });

  process["on"]("exit", () => {
    // This should never happen, it's just a sanity check, just in case
    if (RUNNING_TASKS !== 0) {
      print_fatal("NODE.JS IS EXITING, BUT THERE ARE STILL " + RUNNING_TASKS + " TASKS PENDING!");
    }
  });
}


const task_queue = new Queue();

// Arbitrary number, just so long as it's big enough for normal use cases
const TASK_QUEUE_MAX_CAPACITY = 1024;

const task_queue_flush = () => {
  while (task_queue.length !== 0) {
    task_queue.pull()();
  }
};

// TODO is this a good idea ? it's useful for stuff like Streams, but do we want *all* Tasks to behave this way ?
// TODO use the asap polyfill ?
const asap = (f) => {
  //return f();

  //promise["then"](f);

  // TODO this is necessary to stop infinite loops, but is there a better way ?
  nextTick(f);

  /*if (task_queue.length === 0) {
    task_queue.push(f);
    nextTick(task_queue_flush);
  } else {
    task_queue.push(f);
  }

  // Warn if the task queue gets too big
  if (task_queue.length > TASK_QUEUE_MAX_CAPACITY) {
    console["warn"]("Task queue has " + task_queue.length +
                    " items, which is greater than the max capacity of " +
                    TASK_QUEUE_MAX_CAPACITY);
  }*/

  //return f();
  //process.nextTick(f);
  //setImmediate(f);
  //setTimeout(f, 0);
};


let RUNNING_TASKS = 0;

// TODO is using `| 0` a good idea? is there a better way to get Chrome to treat them as a small uint ?
const PENDING   = 0 | 0;
const SUCCEEDED = 1 | 0;
const ERRORED   = 2 | 0;
const CANCELLED = 3 | 0;
const ABORTED   = 4 | 0;

class Task {
  constructor(onSuccess, onError, onCancel) {
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

  success(value) {
    if (this._state === PENDING) {
      const f = this._onSuccess;

      this._state = SUCCEEDED;
      this._onSuccess = null;
      this._onError = null;
      this._onCancel = null;
      this.onAbort = null; // TODO what if somebody sets onAbort after the Task is succeeded ?

      asap(() => {
        f(value);
        --RUNNING_TASKS; // TODO is this correct ?
      });

    // It's okay for a Task to succeed after an abort
    // TODO we should only allow `success` to be called once, even after an abort
    } else if (this._state !== ABORTED) {
      // TODO if the task is aborted, should it *not* print an error message ?
      // TODO pretty printing for value
      print_fatal("A SUCCESS OCCURRED AFTER THE TASK WAS FINISHED!\n\n" + value);
    }
  }

  error(e) {
    if (this._state === PENDING) {
      const f = this._onError;

      this._state = ERRORED;
      this._onSuccess = null;
      this._onError = null;
      this._onCancel = null;
      this.onAbort = null; // TODO what if somebody sets onAbort after the Task is errored ?

      asap(() => {
        f(e);
        --RUNNING_TASKS; // TODO is this correct ?
      });

    } else {
      // This is to make sure that errors are *never* silently ignored
      print_finished_error(e);
    }
  }

  cancel() {
    if (this._state === PENDING) {
      const f = this._onCancel;

      this._state = CANCELLED;
      this._onSuccess = null;
      this._onError = null;
      this._onCancel = null;
      this.onAbort = null; // TODO what if somebody sets onAbort after the Task is cancelled ?

      asap(() => {
        f();
        --RUNNING_TASKS; // TODO is this correct ?
      });

    // TODO should it be okay for a task to cancel after an abort ?
    } else {
      print_fatal("A CANCEL OCCURRED AFTER THE TASK WAS FINISHED!");
    }
  }

  abort() {
    if (this._state === PENDING) {
      const f = this.onAbort;

      this._state = ABORTED;
      this._onSuccess = null;
      this._onError = null;
      this._onCancel = null;
      this.onAbort = null; // TODO what if somebody sets onAbort after the Task is aborted ?

      // Some tasks can't be aborted
      if (f !== null) {
        // We cannot use asap for this, or it will potentially cause problems (e.g. _bind and _finally)
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
}


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
      task.onAbort = () => {
        remove_array(this._listeners, task);
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

// TODO how to handle the task/promise being aborted ?
export const Promise_from_Task = (t) =>
  new Promise((resolve, reject) => {
    // TODO is cancellation correctly handled ?
    run(t, resolve, reject, reject);
  });

export const print_error = (e) => {
  console["error"](e["stack"]);
};

export const run = (task, onSuccess, onError, onCancel) => {
  const t = new Task(onSuccess, onError, onCancel);
  // TODO maybe use try/catch here ?
  task(t);
  return t;
};

// TODO does this work properly in all platforms ?
const MAX_TIMER = Math.pow(2, 31) - 1;

// TODO test this
export const block = () => {
  // This is necessary to prevent Node.js from exiting before the tasks are complete
  // TODO is there a more efficient way to do this ?
  // TODO maybe only do this on Node.js ?
  // TODO maybe provide a way to disable this ?
  // TODO test this
  const timer = setInterval(noop, MAX_TIMER);

  return (task) => {
    clearInterval(timer);
    task.success(undefined);
  };
};

export const run_root = (f) => {
  // TODO maybe use `execute`, rather than `try/catch` ?
  // TODO is it necessary to use try/catch ?
  try {
    // TODO is it inefficient to use _finally here ?
    run(_finally(f(), block()), noop, print_error, noop);
  } catch (e) {
    print_error(e);
  }
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

// TODO what if the task is aborted ?
export const never = () => (task) => {};

export const _bind = (x, f) => (task) => {
  let aborted = false;

  const success = (value) => {
    task.success(value);
  };

  const error = (e) => {
    task.error(e);
  };

  const cancel = () => {
    task.cancel();
  };

  const t1 = run(x, (value) => {
    if (!aborted) {
      const t2 = run(f(value), success, error, cancel);

      // TODO is it even possible for this to occur ?
      task.onAbort = () => {
        t2.abort();
      };
    }
  }, error, cancel);

  task.onAbort = () => {
    aborted = true;
    t1.abort();
  };
};

// TODO test this
export const with_resource = (before, during, after) => (task) => {
  let aborted = false;

  const success = (value) => {
    task.success(value);
  };

  const error = (e) => {
    task.error(e);
  };

  const cancel = () => {
    task.cancel();
  };

  // This is always run, even if it's aborted
  run(before, (value) => {
    if (aborted) {
      // This is always run, even if it's aborted
      run(after(value), success, error, cancel);

    } else {
      // There's no need to create a new task for this, so we just use the existing one
      _finally(during(value), after(value))(task);
    }
  }, error, cancel);

  task.onAbort = () => {
    aborted = true;
  };
};

export const _finally = (before, after) => (task) => {
  const error = (e) => {
    task.error(e);
  };

  const cancel = () => {
    task.cancel();
  };

  const t = run(before, (value) => {
    // This task is run no matter what, even if it is aborted
    run(after, (_) => {
      task.success(value);
    }, error, cancel);

  }, (e) => {
    // Errors have precedence over cancellations
    const propagate = () => {
      task.error(e);
    };

    // This task is run no matter what, even if it is aborted
    run(after, propagate, error, propagate);

  }, () => {
    // This task is run no matter what, even if it is aborted
    run(after, cancel, error, cancel);
  });

  task.onAbort = () => {
    if (t.abort()) {
      // This task is run no matter what, even if it is aborted
      // There's nothing to return, so we use `noop`
      run(after, noop, error, cancel);
    }
  };
};

export const on_cancel = (x, y) => (task) => {
  let aborted = false;

  const success = (value) => {
    task.success(value);
  };

  const error = (e) => {
    task.error(e);
  };

  const t1 = run(x, success, error, () => {
    // TODO maybe this should execute even if it was aborted ?
    if (!aborted) {
      const t2 = run(y, success, error, () => {
        task.cancel();
      });

      // TODO should this abort ?
      task.onAbort = () => {
        t2.abort();
      };
    }
  });

  task.onAbort = () => {
    aborted = true;
    t1.abort();
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

  task.onAbort = () => {
    t.abort();
  };
};

export const thread = (x) => (task) => {
  task.success(new Thread(x));
};

export const thread_wait = (x) => (task) => {
  x.wait(task);
};

export const thread_kill = (x) => (task) => {
  x.kill(task);
};

export const abortAll = (tasks) => {
  // TODO is it faster to use a var or a let ?
  for (let i = 0; i < tasks["length"]; ++i) {
    tasks[i].abort();
  }
};

// TODO verify that this works correctly in all situations
export const concurrent = (a) => (task) => {
  const out = new Array(a["length"]);

  const tasks = [];

  let pending = a["length"];

  let failed = false;

  const onAbort = () => {
    if (!failed) {
      failed = true;
      abortAll(tasks);
    }
  };

  const onSuccess = () => {
    if (!failed) {
      --pending;
      if (pending === 0) {
        task.success(out);
      }
    }
  };

  const onError = (e) => {
    onAbort();
    // Always emit all the errors
    // The error that is emitted first is non-deterministic
    task.error(e);
  };

  const onCancel = () => {
    onAbort();
    task.cancel();
  };

  for (let i = 0; i < a["length"]; ++i) {
    // TODO test that this is always called asynchronously
    const t = run(a[i], (value) => {
      out[i] = value;
      onSuccess();
    }, onError, onCancel);

    tasks["push"](t);
  }

  task.onAbort = onAbort;
};

// TODO verify that this works correctly in all situations
export const race = (a) => (task) => {
  const tasks = [];

  let done = false;

  const onAbort = () => {
    if (!done) {
      done = true;
      abortAll(tasks);
    }
  };

  const onSuccess = (value) => {
    onAbort();
    task.success(value);
  };

  const onError = (e) => {
    onAbort();
    // Always emit all the errors
    // The error that is emitted first is non-deterministic
    task.error(e);
  };

  // TODO should it only cancel if all the tasks fail ?
  const onCancel = () => {
    onAbort();
    task.cancel();
  };

  // TODO is it faster to use var or let ?
  for (let i = 0; i < a["length"]; ++i) {
    // TODO test that this is always called asynchronously
    tasks["push"](run(a[i], onSuccess, onError, onCancel));
  }

  task.onAbort = onAbort;
};


// Often-used functionality
export const delay = (ms) => (task) => {
  const timer = setTimeout(() => {
    task.success(undefined);
  }, ms);

  task.onAbort = () => {
    clearTimeout(timer);
  };
};

export const log = (s) => (task) => {
  console["log"](s);
  task.success(undefined);
};
