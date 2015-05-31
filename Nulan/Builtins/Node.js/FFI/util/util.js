import { _bind, _void } from "../../../FFI/Task"; // "nulan:Task"


// TODO this should probably be in a different module
export const each_array = (array, f) => {
  const loop = (i) =>
    (i < array["length"]
      ? _bind(f(array[i]), (_) => loop(i + 1))
      : _void);

  return loop(0);
};


let RUNNING = 0;
const MAX_RUNNING = 100; // Somewhat arbitrary number
const PENDING = []; // TODO use Queue ?

// TODO use EMFILE error instead ...?
export const pend = (f) => {
  if (RUNNING === MAX_RUNNING) {
    PENDING["push"](() => {
      ++RUNNING;
      f();
    });

  } else {
    ++RUNNING;
    f();
  }
};

export const unpend = () => {
  --RUNNING;

  if (RUNNING < 0) {
    throw new Error("Negative RUNNING: " + RUNNING);
  }

  if (PENDING["length"]) {
    PENDING["shift"]()();
  }
};


export const waitfor = (limit, cb) => (err) => {
  if (err) {
    cb(err);

  } else {
    --limit;
    if (limit === 0) {
      cb(null);
    }
  }
};


export const callback = (action) => (err, value) => {
  if (err) {
    action.error(err);
  } else {
    action.success(value);
  }
};
