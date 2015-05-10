import { Queue, array_remove } from "./Util";
import { _bind, thread, success, with_resource } from "./Task";


const cancel = (action) => {
  action.cancel();
};

const closed_peek = function (action) {
  if (this._buffer.length) {
    action.success(this._buffer.peek());
  } else {
    this._buffer = null;
    this.peek = cancel;
    this.pull = cancel;
    action.cancel();
  }
};

const closed_pull = function (action) {
  if (this._buffer.length) {
    action.success(this._buffer.pull());
  } else {
    this._buffer = null;
    this.peek = cancel;
    this.pull = cancel;
    action.cancel();
  }
};

const closed_push = (action, value) => {
  action.error(new Error("Cannot push: stream is closed"));
};

const closed_close = (action) => {
  action.error(new Error("Cannot close: stream is already closed"));
};


class Stream {
  constructor(limit) {
    this._limit = limit;
    this._pullers = []; // TODO maybe use a Queue ?
    this._pushers = []; // TODO maybe use a Queue ?
    this._buffer = new Queue();
  }

  cleanup() {
    const a1 = this._pullers;
    const a2 = this._pushers;

    this._limit = null;
    this._pullers = null;
    this._pushers = null;

    // TODO is it faster to use var or let ?
    // This cancels any pending peek/pull
    // This only happens if the buffer is empty
    for (let i = 0; i < a1["length"]; ++i) {
      a1[i].action.cancel();
    }

    if (a2["length"] !== 0) {
      throw new Error("Invalid: expected 0 pushers but got " + a2["length"]);
    }
  }

  close(action) {
    this.peek = closed_peek;
    this.pull = closed_pull;
    this.push = closed_push;
    this.close = closed_close;

    // TODO is this executed in the right order ?
    this.cleanup();
    action.success(undefined);
  }

  peek(action) {
    if (this._buffer.length) {
      action.success(this._buffer.peek());

    } else {
      const info = {
        push: true,
        action: action
      };

      this._pullers["push"](info);

      action.onTerminate = () => {
        // TODO is it possible for `this._pullers` to be `null` ?
        array_remove(this._pullers, info);
      };
    }
  }

  pull(action) {
    // If there is stuff in the buffer
    if (this._buffer.length) {
      const value = this._buffer.pull();

      // If there is a pending push
      if (this._pushers["length"]) {
        const f = this._pushers["shift"]();
        this._buffer.push(f.value);
        f.action.success(undefined);
      }

      action.success(value);

    // Buffer is empty, wait for push
    } else {
      const info = {
        push: false,
        action: action
      };

      this._pullers["push"](info);

      action.onTerminate = () => {
        // TODO is it possible for `this._pullers` to be `null` ?
        array_remove(this._pullers, info);
      };
    }
  }

  push(action, value) {
    // If there is a pending pull
    if (this._pullers["length"]) {
      const f = this._pullers["shift"]();

      if (f.push) {
        this._buffer.push(value);
      }

      f.action.success(value);
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
        // TODO is it possible for `this._pushers` to be `null` ?
        array_remove(this._pushers, info);
      };
    }
  }
}


const make_stream = (action) => {
  // TODO is this a good number for the buffer ?
  action.success(new Stream(1));
};

const close = (stream) => (action) => {
  stream.close(action);
};

/*
Equivalent to this Nulan code:

  (with-resource make_stream close -> stream cleanup
    (DO (ignore-thread
          (cleanup (f -> value
                     (push stream value))))
        (wrap stream)))
*/
export const stream = (f) =>
  with_resource(make_stream, close, (stream, cleanup) => {
    const push = (value) => (action) => {
      stream.push(action, value);
    };
    return _bind(thread(cleanup(f(push))), (_) => success(stream));
  });

export const peek = (stream) => (action) => {
  stream.peek(action);
};

export const pull = (stream) => (action) => {
  stream.pull(action);
};
