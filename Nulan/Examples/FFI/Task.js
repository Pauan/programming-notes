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


const cleanup_success = (value) => {
  // TODO pretty printing for value
  print_warning("action succeeded after completing: " + value);
};

const cleanup_error = (e) => {
  print_warning("action errored after completing:");
  print_error(e);
};

const cleanup_terminate = () => {
  // TODO should this print only when the action is actually terminated twice ?
  print_warning("action terminated after completing");
  return false;
};

const cleanup = (action) => {
  action.success = cleanup_success;
  action.error = cleanup_error;
  action.terminate = cleanup_terminate;
  action.onTerminate = null;
};

export const run = (task, onSuccess, onError) => {
  ++RUNNING_TASKS;

  const action = {
    onTerminate: null,

    success: (value) => {
      // TODO convenience function for this
      //TASK_RUN_STACK["push"](new Error("")["stack"]["split"](/\n */)[2]);

      cleanup(action);

      async(() => {
        onSuccess(value);
        --RUNNING_TASKS;
      });
    },

    error: (e) => {
      cleanup(action);

      async(() => {
        onError(e);
        --RUNNING_TASKS;
      });
    },

    terminate: () => {
      const f = action.onTerminate;

      cleanup(action);

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


export const noop = () => {};

// There's no standard way to terminate a Promise
export const Task_from_Promise = (f) => (action) => {
  f()["then"](action.success, action.error);
};

// TODO how to handle the task/promise being terminated ?
export const Promise_from_Task = (task) =>
  new Promise((resolve, reject) => {
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

export const error = (s) => {
  // TODO better stack traces
  const e = new Error(s);
  return (action) => {
    action.error(e);
  };
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
    // TODO is this correct ?
    if (!terminated) {
      // TODO should this be above the `if` rather than inside it ?
      action.onTerminate = null;

      // Runs the task in a tail-recursive manner, so that it consumes a
      // constant amount of memory, even if it's an infinite loop
      f(value)(action);
    }
  };

  // TODO slightly inefficient
  // TODO is this needed to prevent a memory leak of `a` ?
  (function () {
    const a = run(task, onSuccess, action.error);

    action.onTerminate = () => {
      terminated = true;
      a.terminate();
    };
  })();
};

export const protect_terminate = (task, onTerminated, onSuccess) => (action) => {
  let terminated = false;

  // This is always run, even if it's terminated
  run(task, (value) => {
    action.onTerminate = null;

    if (terminated) {
      // This is always run, even if it's terminated
      run(onTerminated(value), noop, action.error);
    } else {
      onSuccess(value)(action);
    }
  }, action.error);

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
    }, action.error);
  };

  const onError = (e) => {
    // TODO is this necessary to prevent a memory leak ?
    action.onTerminate = null;

    // This task is run no matter what, even if it is terminated
    run(after, (_) => {
      action.error(e);
    }, action.error);
  };

  // TODO slightly inefficient
  // TODO is this needed to prevent a memory leak of `t` ?
  (function () {
    const t = run(before, onSuccess, onError);

    action.onTerminate = () => {
      if (t.terminate()) {
        // This task is run no matter what, even if it is terminated
        // There's nothing to return, so we use `noop`
        // TODO can this be implemented as `after(action)` ?
        run(after, noop, action.error);
      }
    };
  })();
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
        const t = run(a[i], onSuccess, action.error);

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

  for (let i = 0; i < a["length"]; ++i) {
    // TODO test that this is always called asynchronously
    // TODO does this leak `t` after `a[i]` succeeds ?
    const t = run(a[i], (value) => {
      out[i] = value;
      onSuccess();
    }, onError);

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

  // TODO is it faster to use var or let ?
  for (let i = 0; i < a["length"]; ++i) {
    // TODO test that this is always called asynchronously
    actions["push"](run(a[i], onSuccess, onError));
  }

  action.onTerminate = onTerminate;
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
