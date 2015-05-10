export const error_stack = (e) => {
  if (e["stack"] != null) {
    return e["stack"];
  } else {
    // TODO test this
    // TODO I think this was to handle stack overflow errors or something like that ?
    return e;
  }
};

export const fatal_error = (s) => {
  console["error"]("\n" + "="["repeat"](50) + "\n" + s + "\n" + "="["repeat"](50));
};

export const print_error = (e) => {
  console["error"](error_stack(e));
};

export const print_warning = (s) => {
  console["warn"](s);
};


// This is significantly faster than using Array.prototype.reverse
// http://jsperf.com/array-reverse-function
const reverse = (array) => {
  let left  = 0;
  let right = array["length"] - 1;
  while (left <= right) {
    const tmp = array[left];
    array[left] = array[right];
    array[right] = tmp;

    ++left;
    --right;
  }
};

// This implementation has good performance, but not necessarily faster than a raw Array
// http://jsperf.com/promises-queue
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
    if (this.length === 0) {
      this._left["push"](value);
    } else {
      this._right["push"](value);
    }

    ++this.length;
  }

  pull() {
    const left = this._left;

    var value = left["pop"]();

    --this.length;

    if (left["length"] === 0) {
      const right = this._right;

      if (right["length"] > 1) {
        reverse(right);
      }

      this._left = right;
      this._right = left;
    }

    return value;
  }
}


// TODO should this throw an error or something if `x` isn't in `array` ?
// TODO faster implementation of this
export const array_remove = (array, x) => {
  const i = array["indexOf"](x);
  if (i !== -1) {
    array["splice"](i, 1);
  }
};


/*
// TODO use setImmediate shim
export const nextTick =
  // setImmediate is ~52 times faster than setTimeout
  (typeof setImmediate === "function"
    ? setImmediate                   // ~39,000
    : (f) => { setTimeout(f, 0) });  // ~750
*/

const nextTick = (f) => {
  setImmediate(f);
};


const task_queue = new Queue();

// Arbitrary number, just so long as it's big enough for normal use cases
const TASK_QUEUE_MAX_CAPACITY = 1024;

let TASK_QUEUE_FLUSHING = false;

// Macrotask queue scheduler, similar to setImmediate
const task_queue_flush = () => {
  if (!TASK_QUEUE_FLUSHING) {
    TASK_QUEUE_FLUSHING = true;

    const loop = () => {
      let pending = task_queue.length;

      // Process all the tasks that were queued up, but if more tasks are queued, they are not processed
      do {
        // Pull the task out of the queue and then call it
        task_queue.pull()();
        --pending;
      } while (pending !== 0);

      // We're done processing all of the tasks
      if (task_queue.length === 0) {
        TASK_QUEUE_FLUSHING = false;

      // Process any remaining tasks
      } else {
        // TODO this is necessary in order to terminate infinite loops, but is there a better way ?
        nextTick(loop);
      }
    };

    // TODO this is necessary in order to terminate infinite loops, but is there a better way ?
    nextTick(loop);
  }
};

// TODO is this a good idea ? it's useful for stuff like Streams, but do we want *all* Tasks to behave this way ?
// TODO use the asap polyfill ?
export const async = (f) => {
  task_queue.push(f);

  // Warn if the task queue gets too big
  if (task_queue.length > TASK_QUEUE_MAX_CAPACITY) {
    console["warn"]("Task queue has " + task_queue.length +
                    " items, which is greater than the max capacity of " +
                    TASK_QUEUE_MAX_CAPACITY);
  }

  task_queue_flush();
};
