import { array_remove } from "./Util"; // "nulan:Util"


const make_ref = (a) => {
  return {
    value: a,
    waiting: []
  };
};

const ref_change = (ref, value) => {
  // TODO use a better equality predicate ?
  if (ref.value !== value) {
    ref.value = value;

    const a = ref.waiting;

    ref.waiting = [];

    for (var i = 0; i < a["length"]; ++i) {
      a[i](ref, value);
    }
  }
};

const read_from_log = (log, ref) => {
  for (let i = 0; i < log["length"]; ++i) {
    if (log[i].ref === ref) {
      return log[i];
    }
  }

  return null;
};

const add_to_log = (log, ref, value) => {
  log["push"]({
    ref: ref,
    value: value
  });
};

const copy_log = (log) => {
  const out = new Array(log["length"]);

  for (let i = 0; i < log["length"]; ++i) {
    out[i] = {
      ref: log[i].ref,
      value: log[i].value
    };
  }

  return out;
};

const retry_tag = {};


export const _error = (s) => {
  const e = new Error(s);

  return (state) => {
    throw e;
  };
};

export const _wrap = (a) => (state) => a;

export const _bind = (x, f) => (state) => {
  const y = x(state);

  if (y === retry_tag) {
    return y;

  } else {
    // TODO is this correct ?
    return f(y)(state);
  }
};

// TODO this implementation is probably incorrect
export const or = (a) => (state) => {
  for (let i = 0; i < a["length"]; ++i) {
    const new_state = {
      reads:  state.reads,
      writes: copy_log(state.writes)
    };

    const x = a[i](new_state);

    if (x !== retry_tag) {
      state.writes = new_state.writes;
      return x;
    }
  }

  return retry_tag;
};

export const retry = () => (state) => retry_tag;

export const task_make_ref = (value) => (action) => {
  action.success(make_ref(value));
};

export const task_ref_get = (ref) => (action) => {
  action.success(ref.value);
};

export const stm_make_ref = (value) => (state) => {
  return make_ref(value);
};

export const stm_ref_get = (ref) => (state) => {
  const r = read_from_log(state.writes, ref);

  if (r !== null) {
    return r.value;

  } else {
    const r = read_from_log(state.reads, ref);

    if (r !== null) {
      return r.value;

    } else {
      add_to_log(state.reads, ref, ref.value);
      return ref.value;
    }
  }
};

export const stm_ref_set = (ref, value) => (state) => {
  const r = read_from_log(state.writes, ref);

  if (r !== null) {
    r.value = value;

  } else {
    add_to_log(state.writes, ref, value);
  }

  return undefined;
};

const state_is_valid = (state) => {
  // Check for conflicts
  for (let i = 0; i < state.reads["length"]; ++i) {
    const x = state.reads[i];
    // TODO better equality check ?
    if (x.value !== x.ref.value) {
      return false;
    }
  }

  return true;
};

export const atomic = (stm) => {
  const task = (action) => {
    for (;;) {
      const state = {
        reads:  [],
        writes: []
      };

      // TODO does this affect performance ?
      try {
        const value = stm(state);

      } catch (e) {
        if (state_is_valid(state)) {
          action.error(e);
          return;

        // If the transaction had conflicts, retry
        } else {
          continue;
        }
      }

      if (state_is_valid(state)) {
        const reads  = state.reads;
        const writes = state.writes;

        // If the STM returned `retry`...
        if (value === retry_tag) {
          // TODO make sure that callback is only called once
          const callback = (ref) => {
            // TODO is this correct ?
            for (let i = 0; i < reads["length"]; ++i) {
              const x = reads[i].ref;
              // TODO is this correct ?
              if (x !== ref) {
                array_remove(x.waiting, callback);
              }
            }

            // When one of the Refs changes, retry the transaction
            task(action);
          };

          // Wait for one of the Refs to change
          for (let i = 0; i < reads["length"]; ++i) {
            reads[i].ref.waiting["push"](callback);
          }

        } else {
          // If there were no conflicts, commit the changes
          for (let i = 0; i < writes["length"]; ++i) {
            const x = writes[i];
            ref_change(x.ref, x.value);
          }

          action.success(value);
        }

        return;

      // If the transaction had conflicts, retry
      } else {
        continue;
      }
    }
  };

  return task;
};
