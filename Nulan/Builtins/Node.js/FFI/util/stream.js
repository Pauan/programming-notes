import { pull, push } from "../../../FFI/Stream"; // "nulan:Stream"
import { run, _bind, _void } from "../../../FFI/Task"; // "nulan:Task"

const _fs = require("fs");


export const fs_readStream = (fd) =>
  _fs["createReadStream"](null, {
    "encoding": "utf8",
    "fd": fd,
    "autoClose": false
  });

export const fs_writeStream = (fd) => {
  const s = _fs["createWriteStream"](null, {
    "encoding": "utf8",
    "fd": fd,
    "autoClose": false
  });

  // Because Node.js is stupid and doesn't have "autoClose" for
  // `fs.createWriteStream`, we instead have to set this to prevent
  // Node.js from closing the file descriptor
  // TODO this fix might no longer work in future versions of Node.js
  // TODO https://github.com/joyent/node/issues/20880
  s["closed"] = true;

  return s;
};


export const read_from_Node = (input, output) => (action) => {
  let finished = false;

  const cleanup = () => {
    if (!finished) {
      finished = true;
      input["removeListener"]("end", onEnd);
      input["removeListener"]("error", onError);
      input["removeListener"]("readable", onReadable);
    }
  };

  action.onKilled = () => {
    cleanup();
  };

  const onEnd = () => {
    cleanup();
    action.success(undefined);
  };

  const onError = (e) => {
    cleanup();
    action.error(e);
  };

  const onReadable = () => {
    // TODO is this correct ?
    if (!finished) {
      // TODO should this set a byte size for `read` ?
      // TODO is this a good byte size ?
      const chunk = input["read"]();
      if (chunk !== null) {
        // TODO is it possible for a "readable" event to trigger even if `chunk` is not `null` ?
        const t = run(push(output, chunk), onReadable, onError);

        action.onKilled = () => {
          cleanup();
          t.kill();
        };
      }
    }
  };

  input["setEncoding"]("utf8");

  input["on"]("end", onEnd);
  input["on"]("error", onError);
  input["on"]("readable", onReadable);

  onReadable();
};

export const write_to_Node = (input, output, opts) => (action) => {
  let cleaned = false;
  let closed  = false;

  const cleanup = () => {
    closed = true;

    if (!cleaned) {
      cleaned = true;
      output["removeListener"]("finish", onFinish);
      output["removeListener"]("error", onError);
      output["removeListener"]("drain", onDrain);
    }
  };

  action.onKilled = () => {
    // TODO should this end the output ?
    cleanup();
  };

  const onFinish = () => {
    cleanup();
    action.success(undefined);
  };

  const onSuccess = (value) => {
    // Don't write if the Stream is ended
    // TODO is this correct ?
    if (!closed) {
      if (value["length"]) {
        if (output["write"](value[0], "utf8")) {
          onDrain();
        }

      } else {
        // We set this just in case `onDrain` ends up getting called
        closed = true;

        if (opts.end) {
          // We don't cleanup, because that's handled by `onFinish`
          output["end"]();
        } else {
          onFinish();
        }
      }
    }
  };

  const onError = (e) => {
    // TODO should this end the output ?
    cleanup();
    action.error(e);
  };

  const onDrain = () => {
    if (!closed) {
      const t = run(pull(input), onSuccess, onError);

      action.onKilled = () => {
        // TODO should this end the output ?
        cleanup();
        t.kill();
      };
    }
  };

  // TODO this doesn't work
  //output["setDefaultEncoding"]("utf8");

  output["on"]("finish", onFinish);
  output["on"]("error", onError);
  output["on"]("drain", onDrain);

  onDrain();
};
