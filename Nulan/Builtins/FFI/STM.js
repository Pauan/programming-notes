import { array_remove } from "./Util"; // "nulan:Util"


let ref_id = 0;

const make_ref = (a) => {
  return {
    id: ++ref_id,
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

const retry_tag = {};

export const _error = (s) => {
  const e = new Error(s);

  return (reads, writes) => {
    throw e;
  };
};

export const _wrap = (a) => (reads, writes) => a;

export const _bind = (x, f) => (reads, writes) => {
  const y = x(reads, writes);

  if (y === retry_tag) {
    return y;

  } else {
    // TODO is this correct ?
    return f(y)(reads, writes);
  }
};

// TODO this implementation is probably incorrect
export const or = (a) => (reads, writes) => {
  for (let i = 0; i < a["length"]; ++i) {
    const x = a[i](reads, writes);

    if (x !== retry_tag) {
      return x;
    }
  }

  return retry_tag;
};

export const retry = () => (reads, writes) => retry_tag;

export const task_make_ref = (value) => (action) => {
  action.success(make_ref(value));
};

export const task_ref_get = (ref) => (action) => {
  action.success(ref.value);
};

export const stm_make_ref = (value) => (reads, writes) => {
  return make_ref(value);
};

export const stm_ref_get = (ref) => (reads, writes) => {
  const r = writes[ref.id];

  if (r) {
    return r.value;

  } else {
    const r = reads[ref.id];

    if (r) {
      return r.value;

    } else {
      reads[ref.id] = {
        ref: ref,
        value: ref.value
      };

      return ref.value;
    }
  }
};

export const stm_ref_set = (ref, value) => (reads, writes) => {
  const r = writes[ref.id];

  if (r) {
    r.value = value;

  } else {
    writes[ref.id] = {
      ref: ref,
      value: value
    };
  }

  return undefined;
};

export const atomic = (stm) => {
  const task = (action) => {
    for (;;) {
      const reads  = {};
      const writes = {};

      // TODO does this affect performance ?
      try {
        const value = stm(reads, writes);
      } catch (e) {
        action.error(e);
        return;
      }

      // If the STM returned `retry`...
      if (value === retry_tag) {
        // TODO make sure that callback is only called once
        const callback = (ref) => {
          // TODO is this correct ?
          // TODO hasOwnProperty check
          for (let s in reads) {
            const x = reads[s].ref;
            // TODO is this correct ?
            if (x !== ref) {
              array_remove(x.waiting, callback);
            }
          }

          // When one of the Refs changes, retry the transaction
          task(action);
        };

        // Wait for one of the Refs to change
        // TODO hasOwnProperty check
        for (let s in reads) {
          reads[s].ref.waiting["push"](callback);
        }

        return;

      } else {
        let conflicts = false;

        // Check for conflicts
        // TODO hasOwnProperty check
        for (let s in reads) {
          const x = reads[s];
          // TODO better equality check ?
          if (x.value !== x.ref.value) {
            conflicts = true;
            break;
          }
        }

        // If there were conflicts, immediately retry the transaction
        if (!conflicts) {
          // If there were no conflicts, commit the changes
          // TODO hasOwnProperty check
          for (let s in writes) {
            const x = writes[s];
            ref_change(x.ref, x.value);
          }

          action.success(value);
          return;
        }
      }
    }
  };

  return task;
};
