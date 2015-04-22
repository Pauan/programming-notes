import { Queue } from "./Task"; // "nulan:Task"


export const DEFAULT_BUFFER_SIZE = 5;

const check_length = (i) => {
  // TODO should we allow for a buffer of size 0 ?
  if (i >= 1) {
    return true;
  } else {
    throw new Error("Expected 1 or greater but got " + i);
  }
};

const closed_peek = function (task) {
  if (this._buffer.length) {
    task.success(this._buffer.peek());
  } else {
    task.cancel();
  }
};

const closed_pull = function (task) {
  if (this._buffer.length) {
    task.success(this._buffer.pull());
  } else {
    task.cancel();
  }
};

const closed_push = (task, value) => {
  task.cancel();
};

const closed_close = (task) => {
  // TODO is this correct ? maybe it should simply do nothing if you close a Stream multiple times
  task.error(new Error("Cannot close: stream is already closed"));
};


class StreamBase {
  constructor(limit) {
    this._limit = limit;
    this._pullers = [];
    this._buffer = new Queue();
  }

  cleanup() {
    const a = this._pullers;

    this._limit = null;
    this._pullers = null;

    // TODO is it faster to use var or let ?
    for (let i = 0; i < a["length"]; ++i) {
      a[i].task.cancel();
    }
  }

  close(task) {
    console.log("stream close");
    this.peek = closed_peek;
    this.pull = closed_pull;
    this.push = closed_push;
    this.close = closed_close;

    // TODO is this executed in the right order ?
    this.cleanup();

    // TODO should this cancel ?
    task.success(undefined);
  }

  peek(task) {
    if (this._buffer.length) {
      task.success(this._buffer.peek());

    } else {
      this._pullers["push"]({
        push: true,
        task: task
      });
    }
  }

  pull(task) {
    console.log("stream pull");
    if (this._buffer.length) {
      task.success(this._buffer.pull());

    } else {
      this._pullers["push"]({
        push: false,
        task: task
      });
    }
  }

  push(task, value) {
    console.log("----");
    // If there is a pending pull
    if (this._pullers["length"]) {
      console.log("stream push pull");
      const f = this._pullers["shift"]();

      if (f.push) {
        this._buffer.push(value);
      }

      f.task.success(value);
      task.success(undefined);

    // If there is room in the buffer
    } else if (this._buffer.length < this._limit) {
      this._buffer.push(value);
      console.log("stream push buffer", this._buffer.length, this._limit);
      task.success(undefined);

    // Buffer is full
    } else {
      console.log("stream push wait");
      this.full(task, value);
    }
  }
}


class StreamFixed extends StreamBase {
  constructor(limit) {
    super(limit);
    this._pushers = [];
  }

  cleanup() {
    super.cleanup();

    const a = this._pushers;

    this._pushers = null;

    // TODO is it faster to use var or let ?
    for (let i = 0; i < a["length"]; ++i) {
      a[i].task.cancel();
    }
  }

  pull(task) {
    console.log("----");
    // If there is stuff in the buffer
    if (this._buffer.length) {
      console.log("stream pull buffer", this._buffer.length, this._limit);
      const value = this._buffer.pull();

      // If there is a pending push
      if (this._pushers["length"]) {
        console.log("stream pull push");
        const f = this._pushers["shift"]();
        this._buffer.push(f.value);
        f.task.success(undefined);
      }

      task.success(value);

    // Buffer is empty, wait for push
    } else {
      console.log("stream pull wait");
      this._pullers["push"]({
        push: false,
        task: task
      });
    }
  }

  full(task, value) {
    this._pushers["push"]({
      value: value,
      task: task
    });
  }
}


class StreamSliding extends StreamBase {
  full(task, value) {
    // TODO more efficient function for this
    this._buffer.pull();
    this._buffer.push(value);
    task.success(undefined);
  }
}


class StreamDropping extends StreamBase {
  full(task, value) {
    task.success(undefined);
  }
}


export const stream = () => stream_fixed(DEFAULT_BUFFER_SIZE);

export const stream_fixed = (i) => (task) => {
  if (check_length(i)) {
    task.success(new StreamFixed(i));
  }
};

export const stream_sliding = (i) => (task) => {
  if (check_length(i)) {
    task.success(new StreamSliding(i));
  }
};

export const stream_dropping = (i) => (task) => {
  if (check_length(i)) {
    task.success(new StreamDropping(i));
  }
};

export const peek = (stream) => (task) => {
  stream.peek(task);
};

export const pull = (stream) => (task) => {
  stream.pull(task);
};

export const push = (stream, value) => (task) => {
  stream.push(task, value);
};

export const close = (stream) => (task) => {
  stream.close(task);
};
