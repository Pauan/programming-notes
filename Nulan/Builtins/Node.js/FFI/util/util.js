import { increment, decrement } from "../../../FFI/Util"; // "nulan:Util"
import { _finally } from "../../../FFI/Task"; // "nulan:Task"

const _fs   = require("fs");
const _path = require("path");


let RUNNING = 0;
const MAX_RUNNING = 100; // Somewhat arbitrary number
const PENDING = []; // TODO use Queue ?

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


const OPENED_READERS = {};
const OPENED_WRITERS = {};

const write_read_error = (path) =>
  new Error("Cannot read from file \"" + path + "\" at the same time as it's being written");

const read_write_error = (path) =>
  new Error("Cannot write to file \"" + path + "\" at the same time as it's being read");

const write_write_error = (path) =>
  new Error("Cannot write to file \"" + path + "\" at the same time as it's being written");

// TODO what about directories ?
// TODO path normalization
export const with_reading = (path, f) => (action) => {
  if (OPENED_WRITERS[path]) {
    action.error(write_read_error(path));

  } else {
    increment(OPENED_READERS, path);

    _finally(f(), (action) => {
      decrement(OPENED_READERS, path);
      action.success(undefined);
    })(action);
  }
};

// TODO what about directories ?
// TODO path normalization
export const with_writing = (path, f) => (action) => {
  if (OPENED_READERS[path]) {
    action.error(read_write_error(path));

  } else if (OPENED_WRITERS[path]) {
    action.error(write_write_error(path));

  } else {
    increment(OPENED_WRITERS, path);

    _finally(f(), (action) => {
      decrement(OPENED_WRITERS, path);
      action.success(undefined);
    })(action);
  }
};
