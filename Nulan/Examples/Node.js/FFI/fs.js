import { push, pull, close } from "../../FFI/Stream"; // "nulan:Stream"
import { run, _finally, with_resource } from "../../FFI/Task"; // "nulan:Task"

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

  const onReadable = () => {
    // TODO is this correct ?
    if (!finished) {
      // TODO should this set a byte size for `read` ?
      const chunk = input["read"]();
      if (chunk !== null) {
        // TODO is it possible for a "readable" event to trigger even if `chunk` is not `null` ?
        // TODO is it possible for onEnd to be called after the Stream is closed, and thus double-close it ?
        const t = run(push(output, chunk), onReadable, onError, onEnd);

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
  let finished = false;

  const cleanup = () => {
    if (!finished) {
      finished = true;
      output["removeListener"]("finish", onFinish);
      output["removeListener"]("error", onError);
      output["removeListener"]("drain", onDrain);
      // TODO is this correct ?
      output["end"]();
    }
  };

  action.onTerminate = () => {
    cleanup();
  };

  // TODO is this correct? maybe get rid of the "finish" event entirely ?
  const onFinish = () => {
    cleanup();
    action.error(new Error("This should never happen"));
  };

  const onCancel = () => {
    cleanup();
    action.success(undefined);
  };

  const onError = (e) => {
    cleanup();
    action.error(e);
  };

  const onSuccess = (value) => {
    // Don't write if the Stream is ended
    if (!finished) {
      if (output["write"](value, "utf8")) {
        onDrain();
      }
    }
  };

  const onDrain = () => {
    if (!finished) {
      const t = run(pull(input), onSuccess, onError, onCancel);

      action.onTerminate = () => {
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

  // Because Node.js is stupid and doesn't have "autoClose" for
  // `fs.createWriteStream`, we instead have to set this to prevent
  // Node.js from closing the file descriptor
  // TODO this fix might no longer work in future versions of Node.js
  output["closed"] = true;

  onDrain();
};


const fs_close = (fd) => (action) => {
  _fs["close"](fd, callback(action));
};

const fs_open = (path, flags) => (action) => {
  _fs["open"](path, flags, callback(action));
};

export const with_fs_open = (path, flags, f) =>
  with_resource(fs_open(path, flags), f, fs_close);

export const read_file = (path, output) =>
  with_fs_open(path, "r", (fd) =>
   _finally(read_from_Node(_fs["createReadStream"](null, { "encoding": "utf8", "fd": fd, "autoClose": false }), output),
            // TODO maybe this shouldn't close, but should instead let the caller close it ?
            close(output)));

export const write_file = (input, path) =>
  with_fs_open(path, "w", (fd) =>
    write_to_Node(input, _fs["createWriteStream"](null, { "encoding": "utf8", "fd": fd })));

export const rename_file = (from, to) => (action) => {
  _fs["rename"](from, to, callback(action));
};

export const symlink = (from, to) => (action) => {
  _fs["symlink"](from, to, callback(action));
};

// TODO is this necessary / useful ?
export const real_path = (path) => (action) => {
  _fs["realpath"](path, callback(action));
};

export const remove_file = (path) => (action) => {
  _fs["unlink"](path, callback(action));
};

export const remove_directory = (path) => (action) => {
  _fs["rmdir"](path, callback(action));
};

// TODO this should probably return something indicating whether the directory
//      already existed or not, or perhaps have another function for that ?
export const make_directory = (path) => (action) => {
  _fs["mkdir"](path, function (err) {
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
  _fs["readdir"](path, callback(action));
};

// TODO is it faster or slower to use `fs.stat` to check for a directory,
//      rather than relying upon the error message ?
export const files_from_directory_recursive = (file) => (action) => {
  const out = [];

  let pending = 0;

  let terminated = false;

  function loop(files, parent, prefix) {
    pending += files["length"];

    files["forEach"](function (file) {
      const new_parent = _path["join"](parent, file);
      const new_prefix = _path["join"](prefix, file);

      _fs["readdir"](new_parent, function (err, files) {
        if (err) {
          if (err["code"] === "ENOTDIR") {
            if (!terminated) {
              out["push"](new_prefix);

              --pending;
              if (pending === 0) {
                action.success(out);
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
  }

  _fs["readdir"](file, function (err, files) {
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
