import { Queue, array_remove } from "./Util";


const check_length = (i) => {
  // TODO should we allow for a buffer of size 0 ?
  if (i >= 1) {
    return true;
  } else {
    throw new Error("Expected 1 or greater but got " + i);
  }
};

const closed_peek = function (action) {
  if (this._buffer.length) {
    action.success(this._buffer.peek());
  } else {
    action.cancel();
  }
};

const closed_pull = function (action) {
  if (this._buffer.length) {
    action.success(this._buffer.pull());
  } else {
    action.cancel();
  }
};

const closed_push = (action, value) => {
  action.cancel();
};

const closed_close = (action) => {
  // TODO is this correct ? maybe it should simply do nothing if you close a Stream multiple times
  action.error(new Error("Cannot close: stream is already closed"));
};


class StreamBase {
  constructor(limit) {
    this._limit = limit;
    this._pullers = []; // TODO maybe use a Queue ?
    this._buffer = new Queue();
  }

  cleanup() {
    const a = this._pullers;

    this._limit = null;
    this._pullers = null;

    // TODO is it faster to use var or let ?
    // This cancels any pending peek/pull
    // This only happens if the buffer is empty
    for (let i = 0; i < a["length"]; ++i) {
      a[i].action.cancel();
    }
  }

  close(action) {
    this.peek = closed_peek;
    this.pull = closed_pull;
    this.push = closed_push;
    this.close = closed_close;

    // TODO is this executed in the right order ?
    this.cleanup();

    // TODO should this cancel ?
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
    if (this._buffer.length) {
      action.success(this._buffer.pull());

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
      this.full(action, value);
    }
  }
}


class StreamFixed extends StreamBase {
  constructor(limit) {
    super(limit);
    this._pushers = []; // TODO maybe use a Queue ?
  }

  cleanup() {
    super.cleanup();

    const a = this._pushers;

    this._pushers = null;

    // TODO is it faster to use var or let ?
    for (let i = 0; i < a["length"]; ++i) {
      a[i].action.cancel();
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

  full(action, value) {
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


class StreamSliding extends StreamBase {
  full(action, value) {
    // TODO more efficient function for this
    this._buffer.pull();
    this._buffer.push(value);
    action.success(undefined);
  }
}


class StreamDropping extends StreamBase {
  full(action, value) {
    action.success(undefined);
  }
}


export const stream_fixed = (i) => (action) => {
  if (check_length(i)) {
    action.success(new StreamFixed(i));
  }
};

export const stream_sliding = (i) => (action) => {
  if (check_length(i)) {
    action.success(new StreamSliding(i));
  }
};

export const stream_dropping = (i) => (action) => {
  if (check_length(i)) {
    action.success(new StreamDropping(i));
  }
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

export const close = (stream) => (action) => {
  stream.close(action);
};
