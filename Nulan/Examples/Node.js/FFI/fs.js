import { stream, pull } from "../../FFI/Stream"; // "nulan:Stream"
import { run, with_resource } from "../../FFI/Task"; // "nulan:Task"

const _fs   = require("fs");
const _path = require("path");


export const callback = (action) => (err, value) => {
  if (err) {
    action.error(err);
  } else {
    action.success(value);
  }
};


export const read_from_Node = (fd, push) => (action) => {
  const input = _fs["createReadStream"](null, { "encoding": "utf8", "fd": fd, "autoClose": false });

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
      const chunk = input["read"]();
      if (chunk !== null) {
        // TODO is it possible for a "readable" event to trigger even if `chunk` is not `null` ?
        const t = run(push(chunk), onReadable, onError, onCancel);

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

export const write_to_Node = (fd, input) => (action) => {
  const output = _fs["createWriteStream"](null, { "encoding": "utf8", "fd": fd, "autoClose": false });

  let finished = false;

  // TODO only call this once ?
  const cleanup = () => {
    finished = true;
    output["removeListener"]("finish", onFinish);
    output["removeListener"]("error", onError);
    output["removeListener"]("drain", onDrain);
  };

  action.onTerminate = () => {
    // TODO should this end the output ?
    cleanup();
  };

  const onFinish = () => {
    cleanup();
    action.success(undefined);
  };

  // TODO is this whole thing correct ?
  const onCancel = () => {
    // This is just in case `onFinish` gets called before `onCancel`
    if (!finished) {
      // We set this just in case `onDrain` ends up getting called
      finished = true;
      // We don't cleanup, because that's handled by `onFinish`
      output["end"]();
    }
  };

  const onError = (e) => {
    // TODO should this end the output ?
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

  // Because Node.js is stupid and doesn't have "autoClose" for
  // `fs.createWriteStream`, we instead have to set this to prevent
  // Node.js from closing the file descriptor
  // TODO this fix might no longer work in future versions of Node.js
  // TODO https://github.com/joyent/node/issues/20880
  output["closed"] = true;

  onDrain();
};


const fs_close = (fd) => (action) => {
  _fs["close"](fd, callback(action));
};

const fs_open = (path, flags) => (action) => {
  _fs["open"](path, flags, callback(action));
};

export const read_file = (path) =>
  with_resource(fs_open(path, "r"), fs_close,
    (fd, cleanup) => stream((push) => cleanup(read_from_Node(fd, push))));

export const write_file = (path, input) =>
  with_resource(fs_open(path, "w"), fs_close,
    (fd, cleanup) => cleanup(write_to_Node(fd, input)));

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
