import { make_stream, with_stream, pull, push, some, none } from "../../FFI/Stream"; // "nulan:Stream"
import { run, protect_terminate, _finally } from "../../FFI/Task"; // "nulan:Task"
import { increment, decrement } from "../../FFI/Util"; // "nulan:Util"

const _fs   = require("fs");
const _path = require("path");


export const callback = (action) => (err, value) => {
  if (err) {
    action.error(err);
  } else {
    action.success(value);
  }
};


/*export const String_to_Char = (stream) =>
  make_stream((output) =>
    with_stream(stream, some, none, (input) => {
      const pusher = (s, i) =>
        (i < s["length"]
          ? _bind(push(output, s[i]), (_) =>
                  pusher(s, i + 1))
          : loop());

      const loop = () =>
        _bind(pull(input), (value) =>
          (value["length"]
            ? pusher(value[0], 0)
            : _void));

      return loop();
    }));*/

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

  const onReadable = () => {
    // TODO is this correct ?
    if (!finished) {
      // TODO should this set a byte size for `read` ?
      // TODO is this a good byte size ?
      const chunk = input["read"]();
      if (chunk !== null) {
        // TODO is it possible for a "readable" event to trigger even if `chunk` is not `null` ?
        const t = run(push(output, chunk), onReadable, onError);

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

  const onDrain = () => {
    if (!closed) {
      const t = run(pull(input), onSuccess, onError);

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


const OPENED_READERS = {};
const OPENED_WRITERS = {};
const OPENED_FD      = {};

const write_read_error = (path) =>
  new Error("Cannot read, file \"" + path + "\" is being written to");

const read_write_error = (path) =>
  new Error("Cannot write, file \"" + path + "\" is being read from");

const write_write_error = (path) =>
  new Error("Cannot write, file \"" + path + "\" is being written to");

const fs_close = (fd) => (action) => {
  _fs["close"](fd, (err) => {
    if (err) {
      action.error(err);

    } else {
      OPENED_FD[fd]();
      delete OPENED_FD[fd];

      action.success(undefined);
    }
  });
};

// TODO path normalization
const fs_open = (path, flags) => (action) => {
  if (OPENED_WRITERS[path] && flags === "r") {
    action.error(write_read_error(path));

  } else if (OPENED_READERS[path] && flags === "w") {
    action.error(read_write_error(path));

  } else if (OPENED_WRITERS[path] && flags === "w") {
    action.error(write_write_error(path));

  } else {
    const obj = (flags === "r"
                  ? OPENED_READERS
                  // TODO check that flags is "w"
                  : OPENED_WRITERS);

    increment(obj, path);

    _fs["open"](path, flags, (err, fd) => {
      if (err) {
        decrement(obj, path);

        action.error(err);

      } else {
        OPENED_FD[fd] = () => {
          decrement(obj, path);
        };

        action.success(fd);
      }
    });
  }
};

// TODO test that this handles EMFILE correctly
// TODO path normalization
const fs_readdir = (path, f) => {
  if (OPENED_WRITERS[path]) {
    action.error(write_read_error(path));

  } else {
    increment(OPENED_READERS, path);

    _fs["readdir"](path, (err, files) => {
      decrement(OPENED_READERS, path);
      f(err, files);
    });
  }
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

export const write_file = (path, input) =>
  with_stream(input, some, none, (input) =>
    with_fs_open(path, "w", (fd) =>
      write_to_Node(input, fs_writeStream(fd))));

// TODO path normalization
export const rename_file = (from, to) => (action) => {
  if (OPENED_READERS[from]) {
    action.error(read_write_error(from));

  } else if (OPENED_WRITERS[from]) {
    action.error(write_write_error(from));

  } else if (OPENED_READERS[to]) {
    action.error(read_write_error(to));

  } else if (OPENED_WRITERS[to]) {
    action.error(write_write_error(to));

  } else {
    increment(OPENED_WRITERS, from);
    increment(OPENED_WRITERS, to);

    // TODO does this need to handle EMFILE ?
    _fs["rename"](from, to, (err) => {
      decrement(OPENED_WRITERS, from);
      decrement(OPENED_WRITERS, to);

      if (err) {
        action.error(err);
      } else {
        action.success(undefined);
      }
    });
  }
};

// TODO path normalization
export const symlink = (from, to) => (action) => {
  if (OPENED_READERS[from]) {
    action.error(read_write_error(from));

  } else if (OPENED_WRITERS[from]) {
    action.error(write_write_error(from));

  } else {
    increment(OPENED_WRITERS, from);

    // TODO does this need to handle EMFILE ?
    _fs["symlink"](from, to, (err) => {
      decrement(OPENED_WRITERS, from);

      if (err) {
        action.error(err);
      } else {
        action.success(undefined);
      }
    });
  }
};

// TODO is this necessary / useful ?
export const real_path = (path) => (action) => {
  // TODO does this need to handle EMFILE ?
  _fs["realpath"](path, callback(action));
};

// TODO path normalization
export const remove_file = (path) => (action) => {
  // TODO is this necessary ? doesn't the OS keep a file alive as long as there's at least one reference to it ?
  if (OPENED_READERS[path]) {
    action.error(read_write_error(path));

  } else if (OPENED_WRITERS[path]) {
    action.error(write_write_error(path));

  } else {
    increment(OPENED_WRITERS, path);

    // TODO does this need to handle EMFILE ?
    _fs["unlink"](path, (err) => {
      decrement(OPENED_WRITERS, path);

      if (err) {
        action.error(err);
      } else {
        action.success(undefined);
      }
    });
  }
};

// TODO path normalization
export const remove_directory = (path) => (action) => {
  // TODO is this necessary ? doesn't the OS keep a file alive as long as there's at least one reference to it ?
  if (OPENED_READERS[path]) {
    action.error(read_write_error(path));

  } else if (OPENED_WRITERS[path]) {
    action.error(write_write_error(path));

  } else {
    increment(OPENED_WRITERS, path);

    // TODO does this need to handle EMFILE ?
    _fs["rmdir"](path, (err) => {
      decrement(OPENED_WRITERS, path);

      if (err) {
        action.error(err);
      } else {
        action.success(undefined);
      }
    });
  }
};

// TODO this should probably return something indicating whether the directory
//      already existed or not, or perhaps have another function for that ?
// TODO does this need to handle EMFILE ?
// TODO path normalization
export const make_directory = (path) => (action) => {
  // TODO is this necessary ? doesn't the OS keep a file alive as long as there's at least one reference to it ?
  if (OPENED_READERS[path]) {
    action.error(read_write_error(path));

  } else if (OPENED_WRITERS[path]) {
    action.error(write_write_error(path));

  } else {
    increment(OPENED_WRITERS, path);

    _fs["mkdir"](path, (err) => {
      decrement(OPENED_WRITERS, path);

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
  }
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
