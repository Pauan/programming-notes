import { make_stream, with_stream, pull, push, some, none } from "../../FFI/Stream"; // "nulan:Stream"
import { run, protect_terminate, _finally } from "../../FFI/Task"; // "nulan:Task"
//import { Queue } from "../../FFI/Util"; // "nulan:Util"

const _fs   = require("fs");
const _path = require("path");


export const callback = (action) => (err, value) => {
  if (err) {
    action.error(err);
  } else {
    action.success(value);
  }
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

  action.onTerminate = () => {
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

  const onCancel = () => {
    cleanup();
    action.cancel();
  };

  const onReadable = () => {
    // TODO is this correct ?
    if (!finished) {
      // TODO should this set a byte size for `read` ?
      // TODO is this a good byte size ?
      const chunk = input["read"]();
      if (chunk !== null) {
        // TODO is it possible for a "readable" event to trigger even if `chunk` is not `null` ?
        const t = run(push(output, chunk), onReadable, onError, onCancel);

        action.onTerminate = () => {
          cleanup();
          t.terminate();
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

export const write_to_Node = (input, output) => (action) => {
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

  action.onTerminate = () => {
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
        // We don't cleanup, because that's handled by `onFinish`
        output["end"]();
      }
    }
  };

  const onError = (e) => {
    // TODO should this end the output ?
    cleanup();
    action.error(e);
  };

  const onCancel = () => {
    // TODO should this end the output ?
    cleanup();
    action.cancel();
  };

  const onDrain = () => {
    if (!closed) {
      const t = run(pull(input), onSuccess, onError, onCancel);

      action.onTerminate = () => {
        // TODO should this end the output ?
        cleanup();
        t.terminate();
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


/*const FD_QUEUE = new Queue();

const FD_QUEUE_POP = () => {
  if (FD_QUEUE.length) {
    FD_QUEUE.pull()();
  }
};

const FD_QUEUE_PUSH = (value) => {
  FD_QUEUE.push(value);
};*/

const fs_close = (fd) => (action) => {
  _fs["close"](fd, callback(action));

  /*_fs["close"](fd, (err) => {
    if (err) {
      // TODO should it use `FD_QUEUE_POP` here ?
      action.error(err);
    } else {
      FD_QUEUE_POP();
      action.success(undefined);
    }
  });*/
};

const fs_open = (path, flags) => (action) => {
  _fs["open"](path, flags, callback(action));

  /*_fs["open"](path, flags, (err, fd) => {
    if (err) {
      // If there are too many files open, it will wait for a file to close and then try again
      // TODO is it faster/slower to check for EMFILE, or set a hard limit ?
      if (err["code"] === "EMFILE") {
        FD_QUEUE_PUSH(() => {
          fs_open(path, flags)(action);
        });

      } else {
        action.error(err);
      }

    } else {
      action.success(fd);
    }
  });*/
};

// TODO test that this handles EMFILE correctly
const fs_readdir = (path, f) => {
  _fs["readdir"](path, f);

  /*_fs["readdir"](path, (err, files) => {
    // TODO is this correct ?
    FD_QUEUE_POP();

    if (err) {
      // If there are too many files open, it will wait for a file to close and then try again
      // TODO is it faster/slower to check for EMFILE, or set a hard limit ?
      if (err["code"] === "EMFILE") {
        FD_QUEUE_PUSH(() => {
          fs_readdir(path, f);
        });

      } else {
        f(err, files);
      }

    } else {
      f(err, files);
    }
  });*/
};

const fs_readStream = (fd) =>
  _fs["createReadStream"](null, {
    "encoding": "utf8",
    "fd": fd,
    "autoClose": false
  });

const fs_writeStream = (fd) => {
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


const with_fs_open = (path, flags, f) =>
  protect_terminate(fs_open(path, flags), fs_close, (fd) =>
    _finally(f(fd), fs_close(fd)));

export const read_file = (path) =>
  make_stream((output) =>
    with_fs_open(path, "r", (fd) =>
      read_from_Node(fs_readStream(fd), output)));

  /*with_fs_open(path, "r", (fd) =>
    with_stream((push) => read_from_Node(fd, push), fs_close(fd)));*/

export const write_file = (path, input) =>
  with_stream(input, some, none, (input) =>
    with_fs_open(path, "w", (fd) =>
      write_to_Node(input, fs_writeStream(fd))));

export const rename_file = (from, to) => (action) => {
  // TODO does this need to handle EMFILE ?
  _fs["rename"](from, to, callback(action));
};

export const symlink = (from, to) => (action) => {
  // TODO does this need to handle EMFILE ?
  _fs["symlink"](from, to, callback(action));
};

// TODO is this necessary / useful ?
export const real_path = (path) => (action) => {
  // TODO does this need to handle EMFILE ?
  _fs["realpath"](path, callback(action));
};

export const remove_file = (path) => (action) => {
  // TODO does this need to handle EMFILE ?
  _fs["unlink"](path, callback(action));
};

export const remove_directory = (path) => (action) => {
  // TODO does this need to handle EMFILE ?
  _fs["rmdir"](path, callback(action));
};

// TODO this should probably return something indicating whether the directory
//      already existed or not, or perhaps have another function for that ?
// TODO does this need to handle EMFILE ?
export const make_directory = (path) => (action) => {
  _fs["mkdir"](path, (err) => {
    if (err) {
      if (err["code"] === "EEXIST") {
        action.success(undefined);
      } else {
        action.error(err);
      }
    } else {
      action.success(undefined);
    }
  });
};

export const files_from_directory = (path) => (action) => {
  fs_readdir(path, (err, files) => {
    if (err) {
      action.error(err);
    } else {
      action.success(files.sort());
    }
  });
};

// TODO is it faster or slower to use `fs.stat` to check for a directory,
//      rather than relying upon the error message ?
export const files_from_directory_recursive = (file) => (action) => {
  const out = [];

  let pending = 0;

  let terminated = false;

  const loop = (files, parent, prefix) => {
    pending += files["length"];

    files["forEach"]((file) => {
      const new_parent = _path["join"](parent, file);
      const new_prefix = _path["join"](prefix, file);

      fs_readdir(new_parent, (err, files) => {
        if (err) {
          if (err["code"] === "ENOTDIR") {
            if (!terminated) {
              out["push"](new_prefix);

              --pending;
              if (pending === 0) {
                action.success(out.sort());
              }
            }

          } else {
            action.error(err);
          }

        } else if (!terminated) {
          --pending;
          loop(files, new_parent, new_prefix);
        }
      });
    });
  };

  fs_readdir(file, (err, files) => {
    if (err) {
      action.error(err);

    } else if (!terminated) {
      loop(files, file, "");
    }
  });

  action.onTerminate = () => {
    terminated = true;
  };
};
