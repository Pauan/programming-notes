import { array_remove, async, print_error, print_warning } from "./Util";


// TODO what about garbage collection ?
let RUNNING_TASKS = 0;


// For Node.js only
if (typeof process === "object" && typeof process["on"] === "function") {
  process["on"]("uncaughtException", (e) => {
    print_warning("an uncaught error occurred:");
    print_error(e);
    process["exit"](1);
  });

  // TODO this doesn't seem to work
  process["on"]("beforeExit", () => {
    console["log"]("beforeExit");
  });

  process["on"]("exit", () => {
    // This should never happen, it's just a sanity check, just in case
    if (RUNNING_TASKS !== 0) {
      print_warning("Node.js is exiting, but there are still " + RUNNING_TASKS + " tasks pending");
    }
  });
}


const PENDING   = 0;
const SUCCEEDED = 1;
const ERRORED   = 2;
const KILLED    = 3;

export const run = (task, onSuccess, onError) => {
  ++RUNNING_TASKS;

  let state = PENDING;

  const action = {
    // TODO how to prevent code from assigning to this after the action is completed ?
    onKilled: null,

    success: (value) => {
      if (state === PENDING) {
        state = SUCCEEDED;
        action.onKilled = null;

        // TODO convenience function for this
        //TASK_RUN_STACK["push"](new Error("")["stack"]["split"](/\n */)[2]);

        async(() => {
          onSuccess(value);
          --RUNNING_TASKS;
        });

      // It's okay for an action to succeed after being killed
      } else if (state === KILLED) {
        // It's okay to succeed after being killed... but only once
        // TODO this works for now, but a more robust solution would be nice
        state = SUCCEEDED;

      } else {
        // TODO pretty printing for value
        print_warning("Task succeeded after completing (state " + state + "): " + value);
      }
    },

    error: (e) => {
      if (state === PENDING) {
        state = ERRORED;
        action.onKilled = null;

        async(() => {
          onError(e);
          --RUNNING_TASKS;
        });

      } else {
        print_warning("Task errored after completing:");
        print_error(e);
      }
    },

    kill: () => {
      if (state === PENDING) {
        state = KILLED;

        const f = action.onKilled;

        action.onKilled = null;

        // Not every action supports being killed
        if (f !== null) {
          // We can't use `async` (see e.g. _finally, _bind, etc.)
          f();
        }

        --RUNNING_TASKS;
        return true;

      } else {
        return false;
      }
    }
  };

  task(action);

  return action;
};


export const noop = () => {};

// There's currently no standard way to kill a Promise
// https://github.com/promises-aplus/cancellation-spec/issues
export const Task_from_Promise = (f) => (action) => {
  f()["then"](action.success, action.error);
};

export const Promise_from_Task = (task) =>
  new Promise((resolve, reject) => {
    // There's currently no standard way to kill a Promise
    // https://github.com/promises-aplus/cancellation-spec/issues
    run(task, resolve, reject);
  });


// TODO does this work properly in all platforms ?
const MAX_TIMER = Math["pow"](2, 31) - 1;

let block_timer = null;
let block_timer_count = 0;

const block_task = (action) => {
  --block_timer_count;

  if (block_timer_count === 0) {
    clearInterval(block_timer);
    block_timer = null;
  }

  action.success(undefined);
};

// TODO test this
// TODO get rid of this once the Node.js "beforeExit" event works ?
export const block = () => {
  // This is necessary to prevent Node.js from exiting before the tasks are complete
  // TODO is there a more efficient way to do this ?
  // TODO maybe only do this on Node.js ?
  // TODO maybe provide a way to disable this ?
  if (block_timer === null) {
    block_timer = setInterval(noop, MAX_TIMER);
  }

  ++block_timer_count;

  return block_task;
};


export const run_thread = (task) =>
  // It uses `block` to make sure that Node.js doesn't exit until all the Tasks are done
  // TODO is it inefficient to use _finally here ?
  run(_finally(task, block()), noop, print_error);

/*export const thread = (task) => (action) => {
  run_thread(task);
  action.success(undefined);
};*/

export const run_root = (f) => {
  try {
    run_thread(f());
  } catch (e) {
    print_error(e);
  }
};

export const success = (x) => (action) => {
  action.success(x);
};

// TODO better stack traces
export const make_error = (s) => new Error(s);

export const _error = (err) => (action) => {
  action.error(err);
};

// TODO what if the action is killed ?
export const never = () => (action) => {};

export const _void = (action) => {
  action.success(undefined);
};

export const _bind = (task, f) => (action) => {
  // TODO is this necessary ?
  let killed = false;

  const onSuccess = (value) => {
    // TODO is this correct ?
    if (!killed) {
      // TODO should this be above the `if` rather than inside it ?
      action.onKilled = null;

      // Runs the task in a tail-recursive manner, so that it consumes a
      // constant amount of memory, even if it's an infinite loop
      f(value)(action);
    }
  };

  // TODO slightly inefficient
  // TODO is this needed to prevent a memory leak of `a` ?
  (function () {
    const a = run(task, onSuccess, action.error);

    action.onKilled = () => {
      killed = true;
      a.kill();
    };
  })();
};

// TODO could use a better name
export const protect_kill = (task, onKilled, onSuccess) => (action) => {
  let killed = false;

  // This is always run, even if it's killed
  run(task, (value) => {
    action.onKilled = null;

    if (killed) {
      // This is always run, even if it's killed
      run(onKilled(value), noop, action.error);
    } else {
      onSuccess(value)(action);
    }
  }, action.error);

  action.onKilled = () => {
    killed = true;
  };
};

export const on_error = (task, onError, onSuccess) => (action) => {
  let killed = false;

  const success = (value) => {
    if (!killed) {
      action.onKilled = null;
      onSuccess(value)(action);
    }
  };

  const error = (err) => {
    if (!killed) {
      action.onKilled = null;
      onError(err)(action);
    }
  };

  const t = run(task, success, error);

  action.onKilled = () => {
    killed = true;
    t.kill();
  };
};

export const _finally = (before, after) => (action) => {
  const onSuccess = (value) => {
    // TODO is this necessary to prevent a memory leak ?
    action.onKilled = null;

    // This task is run no matter what, even if it is killed
    run(after, (_) => {
      action.success(value);
    }, action.error);
  };

  const onError = (e) => {
    // TODO is this necessary to prevent a memory leak ?
    action.onKilled = null;

    // This task is run no matter what, even if it is killed
    run(after, (_) => {
      action.error(e);
    }, action.error);
  };

  // TODO slightly inefficient
  // TODO is this needed to prevent a memory leak of `t` ?
  (function () {
    const t = run(before, onSuccess, onError);

    action.onKilled = () => {
      if (t.kill()) {
        // This task is run no matter what, even if it is killed
        // There's nothing to return, so we use `noop`
        // TODO can this be implemented as `after(action)` ?
        run(after, noop, action.error);
      }
    };
  })();
};

export const killAll = (actions) => {
  // TODO is it faster to use a var or a let ?
  for (let i = 0; i < actions["length"]; ++i) {
    actions[i].kill();
  }
};

// TODO verify that this works correctly in all situations
// This can be implemented entirely in Nulan, but it's much more efficient to implement it in here
export const sequential = (a) => (action) => {
  const out = new Array(a["length"]);

  let killed = false;

  const loop = (i) => {
    if (i < a["length"]) {
      const onSuccess = (value) => {
        // TODO is this necessary ?
        if (!killed) {
          // TODO is this necessary ?
          action.onKilled = null;
          out[i] = value;
          loop(i + 1);
        }
      };

      // TODO slightly inefficient
      // TODO is this needed to prevent a memory leak of `t` ?
      (function () {
        const t = run(a[i], onSuccess, action.error);

        action.onKilled = () => {
          killed = true;
          t.kill();
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

  const onKilled = () => {
    if (!failed) {
      failed = true;
      killAll(actions);
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
    onKilled();
    // Always emit all the errors
    // The error that is emitted first is non-deterministic
    action.error(e);
  };

  for (let i = 0; i < a["length"]; ++i) {
    // TODO test that this is always called asynchronously
    // TODO does this leak `t` after `a[i]` succeeds ?
    const t = run(a[i], (value) => {
      out[i] = value;
      onSuccess();
    }, onError);

    actions["push"](t);
  }

  action.onKilled = onKilled;
};

// TODO verify that this works correctly in all situations
export const fastest = (a) => (action) => {
  const actions = [];

  let done = false;

  const onKilled = () => {
    if (!done) {
      done = true;
      killAll(actions);
    }
  };

  const onSuccess = (value) => {
    onKilled();
    action.success(value);
  };

  const onError = (e) => {
    onKilled();
    // Always emit all the errors
    // The error that is emitted first is non-deterministic
    action.error(e);
  };

  // TODO is it faster to use var or let ?
  for (let i = 0; i < a["length"]; ++i) {
    // TODO test that this is always called asynchronously
    actions["push"](run(a[i], onSuccess, onError));
  }

  action.onKilled = onKilled;
};


// Often-used functionality
export const log = (s) => (action) => {
  console["log"](s);
  action.success(undefined);
};

export const warn = (s) => (action) => {
  print_warning(s);
  action.success(undefined);
};
