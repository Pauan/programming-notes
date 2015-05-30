import { queue_make, queue_peek, queue_pull, queue_push, array_remove, print_warning } from "./Util";
import { run, _finally, noop } from "./Task";


// TODO maybe move this into Task.js ?
const invalid = (action) => {
  action.error(new Error("Invalid"));
};


// Arbitrary number
const MAX_PENDING = 100;

class Stream {
  constructor(limit, some, none) {
    this._limit = limit;
    this._some = some;
    this._none = none;

    // TODO do we need to use arrays ? is it possible for there to be more than 1 puller/pusher at a time ?
    this._pullers = []; // TODO maybe use a Queue ?
    this._pushers = []; // TODO maybe use a Queue ?
    // TODO since the limit is 1, we don't really need a Queue, an Array will be faster
    this._buffer = queue_make();
  }

  push_puller(info) {
    this._pullers["push"](info);

    const l = this._pullers["length"];
    if (l > MAX_PENDING) {
      print_warning("Too many pullers: " + l);
    }
  }

  push_pusher(info) {
    this._pushers["push"](info);

    const l = this._pushers["length"];
    if (l > MAX_PENDING) {
      print_warning("Too many pushers: " + l);
    }
  }

  done_pushing(action) {
    // Sanity check to make sure that there aren't any pending pushes
    if (this._pushers !== null && this._pushers["length"]) {
      invalid(action);

    } else {
      const pullers = this._pullers;

      this._limit = null;

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

  done_pulling(action, thread) {
    // Sanity check to make sure that there aren't any pending pulls
    if (this._pullers !== null && this._pullers["length"]) {
      invalid(action);

    } else {
      const pushers = this._pushers;

      this._limit = null;
      this._some = null;
      this._none = null;

      this._pullers = null;
      this._buffer = null;

      this.peek = invalid;
      this.pull = invalid;
      this.push = invalid;
      this.done_pulling = invalid;

      thread.kill();

      // This has to go after killing the thread, (see `action.onKilled` of `push`)
      this._pushers = null;

      // TODO is this check a good idea ?
      // TODO isn't this handled by done_pushing ?
      if (pushers !== null && pushers["length"]) {
        action.error(new Error("There are still " + pushers["length"] + " pending pushes after being killed"));
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

      this.push_puller(info);

      action.onKilled = () => {
        // TODO is it possible for `this._pullers` to be `null` ?
        array_remove(this._pullers, info);
      };
    }
  }

  peek(action) {
    if (this._buffer.length) {
      action.success(this._some(queue_peek(this._buffer)));

    } else {
      this.wait(action, true);
    }
  }

  pull(action) {
    // If there is stuff in the buffer
    if (this._buffer.length) {
      const value = queue_pull(this._buffer);

      const pushers = this._pushers;

      // If there is a pending push
      if (pushers !== null && pushers["length"]) {
        const f = pushers["shift"]();
        queue_push(this._buffer, f.value);
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
        queue_push(this._buffer, value);
      }

      f.action.success(this._some(value));
      action.success(undefined);

    // If there is room in the buffer
    } else if (this._buffer.length < this._limit) {
      queue_push(this._buffer, value);
      action.success(undefined);

    // Buffer is full
    } else {
      const info = {
        value: value,
        action: action
      };

      this.push_pusher(info);

      action.onKilled = () => {
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

const done_pulling = (stream, thread) => (action) => {
  stream.done_pulling(action, thread);
};

export const make_stream = (f) => f;

export const with_stream = (stream, some, none, f) => (action) => {
  const s = new Stream(DEFAULT_STREAM_LIMIT, some, none);

  // This is similar to using `concurrent`,
  // except that `done_pulling` kills `t1`
  const t1 = run(_finally(stream(s), done_pushing(s)), noop, (e) => {
    t2.kill();
    action.error(e);
  });

  // TODO it asynchronously kills `t1` ... is that okay ?
  const t2 = run(_finally(f(s), done_pulling(s, t1)), action.success, action.error);

  action.onKilled = () => {
    // TODO should it kill both of them, or only `t2` ?
    t1.kill();
    t2.kill();
  };
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
