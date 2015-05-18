import { Queue, array_remove } from "./Util";
import { run_thread, _finally } from "./Task";


// TODO maybe move this into Task.js ?
const invalid = (action) => {
  action.error(new Error("Invalid"));
};


class Stream {
  constructor(limit, some, none) {
    this._limit = limit;
    this._some = some;
    this._none = none;

    this._thread = null;
    // TODO do we need to use arrays ? is it possible for there to be more than 1 puller/pusher at a time ?
    this._pullers = []; // TODO maybe use a Queue ?
    this._pushers = []; // TODO maybe use a Queue ?
    // TODO since the limit is 1, we don't really need a Queue, an Array will be faster
    this._buffer = new Queue();
  }

  done_pushing(action) {
    // Sanity check to make sure that there aren't any pending pushes
    if (this._pushers !== null && this._pushers["length"]) {
      invalid(action);

    } else {
      const pullers = this._pullers;

      this._limit = null;

      this._thread = null;
      this._pullers = null;
      this._pushers = null;

      this.push = invalid;
      this.done_pushing = invalid;

      if (pullers !== null) {
        // TODO is it faster to use var or let ?
        // This cancels any pending peek/pull
        // This only happens if the buffer is empty
        for (let i = 0; i < pullers["length"]; ++i) {
          pullers[i].action.success(this._none());
        }
      }

      action.success(undefined);
    }
  }

  done_pulling(action) {
    // Sanity check to make sure that there aren't any pending pulls
    if (this._pullers !== null && this._pullers["length"]) {
      invalid(action);

    } else {
      const pushers = this._pushers;
      const thread = this._thread;

      this._limit = null;
      this._some = null;
      this._none = null;

      this._thread = null;
      this._pullers = null;
      this._buffer = null;

      this.peek = invalid;
      this.pull = invalid;
      this.push = invalid;
      this.done_pulling = invalid;

      if (thread !== null) {
        thread.terminate();
      }

      // This has to go after termination
      this._pushers = null;

      // TODO is this check a good idea ?
      if (pushers !== null && pushers["length"]) {
        action.error(new Error("There are still " + pushers["length"] + " pending pushes after termination"));
      } else {
        action.success(undefined);
      }
    }
  }

  wait(action, push) {
    // Stream is closed
    if (this._pullers === null) {
      action.success(this._none());

    } else {
      const info = {
        push: push,
        action: action
      };

      this._pullers["push"](info);

      action.onTerminate = () => {
        // TODO is it possible for `this._pullers` to be `null` ?
        array_remove(this._pullers, info);
      };
    }
  }

  peek(action) {
    if (this._buffer.length) {
      action.success(this._some(this._buffer.peek()));

    } else {
      this.wait(action, true);
    }
  }

  pull(action) {
    // If there is stuff in the buffer
    if (this._buffer.length) {
      const value = this._buffer.pull();

      const pushers = this._pushers;

      // If there is a pending push
      if (pushers !== null && pushers["length"]) {
        const f = pushers["shift"]();
        this._buffer.push(f.value);
        f.action.success(undefined);
      }

      action.success(this._some(value));

    // Buffer is empty, wait for push
    } else {
      this.wait(action, false);
    }
  }

  push(action, value) {
    // If there is a pending pull
    if (this._pullers["length"]) {
      const f = this._pullers["shift"]();

      if (f.push) {
        this._buffer.push(value);
      }

      f.action.success(this._some(value));
      action.success(undefined);

    // If there is room in the buffer
    } else if (this._buffer.length < this._limit) {
      this._buffer.push(value);
      action.success(undefined);

    // Buffer is full
    } else {
      const info = {
        value: value,
        action: action
      };

      this._pushers["push"](info);

      action.onTerminate = () => {
        array_remove(this._pushers, info);
      };
    }
  }
}


export const some = (value) => [value];

export const none = () => [];


const DEFAULT_STREAM_LIMIT = 1;

const done_pushing = (stream) => (action) => {
  stream.done_pushing(action);
};

const done_pulling = (stream) => (action) => {
  stream.done_pulling(action);
};

export const make_stream = (f) => f;

export const with_stream = (stream, some, none, f) => (action) => {
  const s = new Stream(DEFAULT_STREAM_LIMIT, some, none);

  s._thread = run_thread(_finally(stream(s), done_pushing(s)));

  _finally(f(s), done_pulling(s))(action);
};

export const peek = (stream) => (action) => {
  stream.peek(action);
};

export const pull = (stream) => (action) => {
  stream.pull(action);
};

export const push = (stream, value) => (action) => {
  stream.push(action, value);
};
