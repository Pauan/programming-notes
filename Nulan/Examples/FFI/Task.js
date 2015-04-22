// TODO this probably belongs in another module
// TODO is this *actually* any faster than just using an array ?
export class Queue {
  constructor() {
    this._left  = [];
    this._right = [];
    this.length = 0;
  }

  peek() {
    return this._left[this._left["length"] - 1];
  }

  push(value) {
    ++this.length;

    if (this._left["length"]) {
      this._right["push"](value);
    } else {
      this._left["push"](value);
    }
  }

  pull() {
    --this.length;

    const left = this._left;

    var value = left["pop"]();

    if (left["length"] === 0) {
      const right = this._right;

      if (right["length"] > 1) {
        // TODO faster function for this ?
        right.reverse();
      }

      this._left = right;
      this._right = left;
    }

    return value;
  }
}


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
    }
  }

  abort() {
    if (this._pending) {
      const f = this.onAbort;

      this._pending = false;
      this._onSuccess = null;
      this._onError = null;
      this._onCancel = null;
      this.onAbort = null; // TODO what if somebody sets onAbort after the Task is aborted ?

      // Some tasks can't be aborted
      if (f !== null) {
        // TODO should this use asap ?
        f();
      }
    }
  }
}


const PENDING   = 0;
const SUCCEEDED = 1;
const CANCELLED = 2;
const ABORTED   = 3;

class Thread {
  constructor(task) {
    this._state = PENDING;
    this._value = null;
    this._listeners = [];

    this._task = run(task, (value) => {
      if (this._state === PENDING) {
        const f = this._listeners;

        this._state = SUCCEEDED;
        this._value = value;
        this._listeners = null;
        this._task = null;

        // TODO this can be made a bit faster
        f["forEach"]((x) => { x.success(value) });
      }

    }, (e) => {
      if (this._state === PENDING) {
        this._cancel();
        print_error(e);
      }

    }, () => {
      if (this._state === PENDING) {
        this._cancel();
      }
    });
  }

  _cancel() {
    const f = this._listeners;

    // TODO verify that _value is null ?
    this._state = CANCELLED;
    this._listeners = null;
    this._task = null;

    // TODO this can be made a bit faster
    f["forEach"]((x) => { x.cancel() });
  }

  wait(task) {
    switch (this._state) {
    case PENDING:
      this._listeners["push"](task);

      // TODO test this
      task.onAbort = () => {
        // TODO is it possible for this to be called after `_listeners` is set to `null` ?
        // TODO replace with faster `remove` function
        const i = this._listeners["indexOf"](task);
        // TODO assert that `i` is never `-1` ?
        if (i !== -1) {
          this._listeners["splice"](i, 1);
        }
      };
      break;

    case SUCCESS:
      task.success(this._value);
      break;

    case CANCELLED:
      task.cancel();
      break;

    // TODO is this correct ?
    case ABORTED:
      task.cancel();
      break;
    }
  }

  kill() {
    if (this._state === PENDING) {
      const t = this._task;
      const f = this._listeners;

      // TODO verify that _value is null ?
      this._state = ABORTED;
      this._listeners = null;
      this._task = null;

      // TODO this can be made a bit faster
      f["forEach"]((x) => { x.cancel() });

      // TODO should this be before or after cancelling the listeners ?
      t.abort();
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

    task.onAbort = () => {
      t2.abort();
    };
  }, error, cancel);

  task.onAbort = () => {
    t1.abort();
  };
};

export const _finally = (before, after) => (task) => {
  const error = (e) => {
    task.error(e);
  };

  const cancel = () => {
    task.cancel();
  };

  const t1 = run(before, (value) => {
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
  }, cancel);

  // TODO should this run the `after` task ?
  task.onAbort = () => {
    t1.abort();
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
    task.onAbort = () => {
      t2.abort();
    };
  });

  task.onAbort = () => {
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

const abortAll = (tasks) => {
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

  const onSuccess = () => {
    --pending;
    if (pending === 0) {
      task.success(out);
    }
  };

  const onError = (e) => {
    failed = true;
    abortAll(tasks);
    task.error(e);
  };

  const onCancel = () => {
    failed = true;
    abortAll(tasks);
    task.cancel();
  };

  for (let i = 0; i < a["length"]; ++i) {
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

  task.onAbort = () => {
    abortAll(tasks);
  };
};

// TODO verify that this works correctly in all situations
export const race = (a) => (task) => {
  const tasks = [];

  let done = false;

  const onSuccess = (value) => {
    done = true;
    abortAll(tasks);
    task.success(value);
  };

  const onError = (e) => {
    done = true;
    abortAll(tasks);
    task.error(e);
  };

  // TODO should it only cancel if all the tasks fail ?
  const onCancel = () => {
    done = true;
    abortAll(tasks);
    task.cancel();
  };

  // TODO is it faster to use var or let ?
  for (let i = 0; i < a["length"]; ++i) {
    if (done) {
      break;

    } else {
      tasks["push"](run(a[i], onSuccess, onError, onCancel));
    }
  }

  task.onAbort = () => {
    abortAll(tasks);
  };
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
