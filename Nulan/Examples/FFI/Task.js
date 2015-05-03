import { array_remove, async, error_stack, fatal_error, print_error } from "./Util";


let RUNNING_TASKS = 0;


// For Node.js only
if (typeof process === "object" && typeof process["on"] === "function") {
  process["on"]("uncaughtException", (e) => {
    fatal_error("AN UNCAUGHT ERROR OCCURRED!\n\n" + error_stack(e));
    process["exit"](1);
  });

  // TODO this doesn't seem to work
  process["on"]("beforeExit", () => {
    console["log"]("beforeExit");
  });

  process["on"]("exit", () => {
    // This should never happen, it's just a sanity check, just in case
    if (RUNNING_TASKS !== 0) {
      fatal_error("NODE.JS IS EXITING, BUT THERE ARE STILL " + RUNNING_TASKS + " TASKS PENDING!");
    }
  });
}


// TODO it shouldn't allow for calling cleanup_success twice
const cleanup_success = (value) => {};

const cleanup_success_error = (value) => {
  // TODO pretty printing for value
  fatal_error("INVALID SUCCESS!\n\n" + value);
};

const cleanup_error = (e) => {
  fatal_error("INVALID ERROR!\n\n" + error_stack(e));
};

const cleanup_cancel = () => {
  fatal_error("INVALID CANCEL!");
};

const cleanup_terminate = () => {
  return false;
};

const cleanup_terminate_error = () => {
  fatal_error("CANNOT TERMINATE THE SAME ACTION TWICE!");
  return false;
};

const cleanup = (action, success, terminate) => {
  action.success = success;
  action.error = cleanup_error;
  action.cancel = cleanup_cancel;
  action.terminate = terminate;
  action.onTerminate = null;
};

export const run = (task, onSuccess, onError, onCancel) => {
  ++RUNNING_TASKS;

  const action = {
    onTerminate: null,

    success: (value) => {
      // It's okay to call terminate after success
      cleanup(action, cleanup_success_error, cleanup_terminate);

      async(() => {
        onSuccess(value);
        --RUNNING_TASKS;
      });
    },

    error: (e) => {
      // It's okay to call terminate after error
      cleanup(action, cleanup_success_error, cleanup_terminate);

      async(() => {
        onError(e);
        --RUNNING_TASKS;
      });
    },

    cancel: () => {
      // It's okay to call terminate after cancel
      cleanup(action, cleanup_success_error, cleanup_terminate);

      async(() => {
        onCancel();
        --RUNNING_TASKS;
      });
    },

    terminate: () => {
      const f = action.onTerminate;

      cleanup(action, cleanup_success_error, cleanup_terminate_error);

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


// TODO is using `| 0` a good idea? is there a better way to get Chrome to treat them as a small uint ?
const PENDING    = 0 | 0;
const SUCCEEDED  = 1 | 0;
const ERRORED    = 2 | 0;
const CANCELLED  = 3 | 0;
const TERMINATED = 4 | 0;

class Thread {
  constructor(task) {
    this._state = PENDING;
    this._value = null;
    this._listeners = [];

    // This is to make sure that Node.js doesn't exit until all the Tasks are done
    this._action = run(_finally(task, block()), (value) => {
      if (this._state === PENDING) {
        const a = this._listeners;

        this._state = SUCCEEDED;
        this._value = value;
        this._listeners = null;
        this._action = null;

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
    this._action = null;

    // TODO this can be made a bit faster
    a["forEach"]((x) => { x.cancel() });
  }

  wait(action) {
    switch (this._state) {
    case PENDING:
      this._listeners["push"](action);

      // TODO test this
      action.onTerminate = () => {
        array_remove(this._listeners, action);
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

  kill(action) {
    switch (this._state) {
    case PENDING:
      const t = this._action;
      const a = this._listeners;

      // TODO verify that _value is null ?
      this._state = TERMINATED;
      this._listeners = null;
      this._action = null;

      // TODO this can be made a bit faster
      a["forEach"]((x) => { x.cancel() });

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
}


export const noop = () => {};

// There's no standard way to cancel/terminate a Promise
export const Task_from_Promise = (f) => (action) => {
  f()["then"](action.success, action.error);
};

// TODO how to handle the task/promise being terminated ?
export const Promise_from_Task = (task) =>
  new Promise((resolve, reject) => {
    // TODO is cancellation correctly handled ?
    run(task, resolve, reject, reject);
  });

// TODO does this work properly in all platforms ?
const MAX_TIMER = Math["pow"](2, 31) - 1;

// TODO test this
// TODO it creates a new timer for each Thread, it would be better to use a single timer
export const block = () => {
  // This is necessary to prevent Node.js from exiting before the tasks are complete
  // TODO is there a more efficient way to do this ?
  // TODO maybe only do this on Node.js ?
  // TODO maybe provide a way to disable this ?
  // TODO test this
  const timer = setInterval(noop, MAX_TIMER);

  return (action) => {
    clearInterval(timer);
    action.success(undefined);
  };
};

export const run_root = (f) => {
  // TODO I'd like to use `execute`, but I can't, because `f` returns a `Task`, so I'd have to double-run it
  try {
    // TODO is it inefficient to use _finally here ?
    run(_finally(f(), block()), noop, print_error, noop);
  } catch (e) {
    print_error(e);
  }
};

// This can be implemented entirely with `execute`,
// but it's faster to implement it like this
export const success = (x) => (action) => {
  action.success(x);
};

export const error = (s) => {
  // TODO better stack traces
  const e = new Error(s);
  return (action) => {
    action.error(e);
  };
};

export const cancel = () => (action) => {
  action.cancel();
};

// TODO what if the action is terminated ?
export const never = () => (action) => {};

export const _void = (action) => {
  action.success(undefined);
};

export const _bind = (task, f) => (action) => {
  // TODO is this necessary ?
  let terminated = false;

  const onSuccess = (value) => {
    if (!terminated) {
      action.onTerminate = null;

      // Runs the task in a tail-recursive manner, so that it consumes a
      // constant amount of memory, even if it's an infinite loop
      f(value)(action);
    }
  };

  // TODO slightly inefficient
  // TODO is this needed to prevent a memory leak of `a` ?
  (function () {
    const a = run(task, onSuccess, action.error, action.cancel);

    action.onTerminate = () => {
      terminated = true;
      a.terminate();
    };
  })();
};

// TODO test this
export const with_resource = (before, during, after) => (action) => {
  let terminated = false;

  // This is always run, even if it's terminated
  run(before, (value) => {
    action.onTerminate = null;

    // TODO is this correct ?
    if (terminated) {
      // This is always run, even if it's terminated
      // TODO maybe this should use `after(value)(action)` instead ?
      run(after(value), noop, action.error, action.cancel);

    } else {
      // There's no need to create a new action for this, so we just use the existing one
      _finally(during(value), after(value))(action);
    }
  }, action.error, action.cancel);

  action.onTerminate = () => {
    terminated = true;
  };
};

export const _finally = (before, after) => (action) => {
  const onSuccess = (value) => {
    // TODO is this necessary to prevent a memory leak ?
    action.onTerminate = null;

    // This task is run no matter what, even if it is terminated
    run(after, (_) => {
      action.success(value);
    }, action.error, action.cancel);
  };

  const onError = (e) => {
    // TODO is this necessary to prevent a memory leak ?
    action.onTerminate = null;

    // Errors have precedence over cancellations
    const propagate = () => {
      action.error(e);
    };

    // This task is run no matter what, even if it is terminated
    run(after, propagate, action.error, propagate);
  };

  const onCancel = () => {
    // TODO is this necessary to prevent a memory leak ?
    action.onTerminate = null;

    // This task is run no matter what, even if it is terminated
    run(after, action.cancel, action.error, action.cancel);
  };

  // TODO slightly inefficient
  // TODO is this needed to prevent a memory leak of `t` ?
  (function () {
    const t = run(before, onSuccess, onError, onCancel);

    action.onTerminate = () => {
      if (t.terminate()) {
        // This task is run no matter what, even if it is terminated
        // There's nothing to return, so we use `noop`
        // TODO can this be implemented as `after(action)` ?
        run(after, noop, action.error, action.cancel);
      }
    };
  })();
};

export const on_cancel = (task, x, y) => (action) => {
  // TODO is this necessary ?
  let terminated = false;

  const onSuccess = (value) => {
    if (!terminated) {
      action.onTerminate = null;
      // Tail recursive
      x(value)(action);
    }
  };

  const onCancel = () => {
    // TODO maybe this should execute even if it was terminated ?
    if (!terminated) {
      action.onTerminate = null;
      // Tail recursive
      y(action);
    }
  };

  // TODO slightly inefficient
  // TODO is this needed to prevent a memory leak of `a` ?
  (function () {
    const a = run(task, onSuccess, action.error, onCancel);

    action.onTerminate = () => {
      terminated = true;
      a.terminate();
    };
  })();
};

export const execute = (f) => (action) => {
  try {
    action.success(f());
  } catch (e) {
    action.error(e);
  }
};

export const thread = (task) => (action) => {
  action.success(new Thread(task));
};

export const thread_wait = (thread) => (action) => {
  thread.wait(action);
};

export const thread_kill = (thread) => (action) => {
  thread.kill(action);
};

export const terminateAll = (actions) => {
  // TODO is it faster to use a var or a let ?
  for (let i = 0; i < actions["length"]; ++i) {
    actions[i].terminate();
  }
};

// TODO verify that this works correctly in all situations
// This can be implemented entirely in Nulan, but it's much more efficient to implement it in here
export const sequential = (a) => (action) => {
  const out = new Array(a["length"]);

  let terminated = false;

  const loop = (i) => {
    if (i < a["length"]) {
      const onSuccess = (value) => {
        // TODO is this necessary ?
        if (!terminated) {
          // TODO is this necessary ?
          action.onTerminate = null;
          out[i] = value;
          loop(i + 1);
        }
      };

      // TODO slightly inefficient
      // TODO is this needed to prevent a memory leak of `t` ?
      (function () {
        const t = run(a[i], onSuccess, action.error, action.cancel);

        action.onTerminate = () => {
          terminated = true;
          t.terminate();
        };
      })();

    } else {
      action.success(out);
    }
  };

  loop(0);
};

// TODO verify that this works correctly in all situations
export const concurrent = (a) => (action) => {
  const out = new Array(a["length"]);

  const actions = [];

  let pending = a["length"];

  let failed = false;

  const onTerminate = () => {
    if (!failed) {
      failed = true;
      terminateAll(actions);
    }
  };

  const onSuccess = () => {
    if (!failed) {
      --pending;
      if (pending === 0) {
        action.success(out);
      }
    }
  };

  const onError = (e) => {
    onTerminate();
    // Always emit all the errors
    // The error that is emitted first is non-deterministic
    action.error(e);
  };

  const onCancel = () => {
    onTerminate();
    action.cancel();
  };

  for (let i = 0; i < a["length"]; ++i) {
    // TODO test that this is always called asynchronously
    // TODO does this leak `t` after `a[i]` succeeds ?
    const t = run(a[i], (value) => {
      out[i] = value;
      onSuccess();
    }, onError, onCancel);

    actions["push"](t);
  }

  action.onTerminate = onTerminate;
};

// TODO verify that this works correctly in all situations
export const fastest = (a) => (action) => {
  const actions = [];

  let done = false;

  const onTerminate = () => {
    if (!done) {
      done = true;
      terminateAll(actions);
    }
  };

  const onSuccess = (value) => {
    onTerminate();
    action.success(value);
  };

  const onError = (e) => {
    onTerminate();
    // Always emit all the errors
    // The error that is emitted first is non-deterministic
    action.error(e);
  };

  // TODO should it only cancel if all the tasks fail ?
  const onCancel = () => {
    onTerminate();
    action.cancel();
  };

  // TODO is it faster to use var or let ?
  for (let i = 0; i < a["length"]; ++i) {
    // TODO test that this is always called asynchronously
    actions["push"](run(a[i], onSuccess, onError, onCancel));
  }

  action.onTerminate = onTerminate;
};


// Often-used functionality
export const log = (s) => (action) => {
  console["log"](s);
  action.success(undefined);
};
