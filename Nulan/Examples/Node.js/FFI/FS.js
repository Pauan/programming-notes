import { push, pull, close } from "../../FFI/Stream"; // "nulan:Stream"
import { _bind, run, _finally } from "../../FFI/Task"; // "nulan:Task"

const fs = require("fs");
const path = require("path");


export const callback = (task) => (err, value) => {
  if (err) {
    task.error(err);
  } else {
    task.success(value);
  }
};


export const read_from_Node = (input, output) => (task) => {
  let finished = false;

  const cleanup = () => {
    finished = true;
    input["removeListener"]("end", onEnd);
    input["removeListener"]("error", onError);
    input["removeListener"]("readable", onReadable);
  };

  task.onAbort = (done) => {
    if (!finished) {
      cleanup();
    }
    done();
  };

  const onEnd = () => {
    if (!finished) {
      cleanup();
      task.success(undefined);
    }
  };

  const onError = (e) => {
    if (!finished) {
      cleanup();
    }
    task.error(e);
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

        task.onAbort = (done) => {
          if (!finished) {
            cleanup();
          }
          t.abort(done);
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

export const write_to_Node = (input, output) => (task) => {
  let finished = false;

  const cleanup = () => {
    finished = true;
    output["removeListener"]("finish", onFinish);
    output["removeListener"]("error", onError);
    output["removeListener"]("drain", onDrain);
    // TODO is this correct ?
    output["end"]();
  };

  task.onAbort = (done) => {
    if (!finished) {
      cleanup();
    }
    done();
  };

  const onFinish = () => {
    if (!finished) {
      cleanup();
      task.success(undefined);
    }
  };

  const onError = (e) => {
    if (!finished) {
      cleanup();
    }
    task.error(e);
  };

  const onSuccess = (value) => {
    if (!finished) {
      if (output["write"](value, "utf8")) {
        onDrain();
      }
    }
  };

  const onDrain = () => {
    if (!finished) {
      const t = run(pull(input), onSuccess, onError, onFinish);

      task.onAbort = (done) => {
        if (!finished) {
          cleanup();
        }
        t.abort(done);
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


const fs_close = (fd) => (task) {
  fs["close"](fd, callback(task));
};

const fs_open = (path, flags) => (task) {
  let aborted = false;
  let done = null;

  fs["open"](path, flags, (err, fd) => {
    if (aborted) {
      if (err) {
        task.error(err);
        done();

      } else {
        fs["close"](fd, (err) => {
          if (err) {
            task.error(err);
          }
          done();
        });
      }

    } else if (err) {
      task.error(err);

    } else {
      task.success(fd);
    }
  });

  task.onAbort = (f) => {
    aborted = true;
    done = f;
  };
};

export const with_fs_open = (path, flags, f) =>
  _bind(fs_open(path, flags), (fd) =>
    _finally(f(fd), fs_close(fd)));

export const read_file = (path, output) =>
  with_fs_open(path, "r", (fd) =>
    // TODO do we have to use `autoClose: false` ?
    _finally(read_from_Node(fs["createReadStream"](null, { "encoding": "utf8", "fd": fd }), output),
             close(output)));

export const write_file = (input, path) =>
  with_fn_open(path, "w", (fd) =>
    // TODO createWriteStream doesn't have autoclose, do we have to manually `end` the stream ?
    // TODO should this close the input ?
    _finally(write_to_Node(input, fs["createWriteStream"](null, { "encoding": "utf8", "fd": fd })),
             close(input)));

export const rename_file = (from, to) => (task) => {
  fs["rename"](from, to, callback(task));
};

export const symlink = (from, to) => (task) => {
  fs["symlink"](from, to, callback(task));
};

// TODO is this necessary / useful ?
export const real_path = (path) => (task) => {
  fs["realpath"](path, callback(task));
};

export const remove_file = (path) => (task) => {
  fs["unlink"](path, callback(task));
};

export const remove_directory = (path) => (task) => {
  fs["rmdir"](path, callback(task));
};

// TODO this should probably return something indicating whether the directory
//      already existed or not, or perhaps have another function for that ?
export const make_directory = (path) => (task) => {
  fs["mkdir"](path, function (err) {
    if (err) {
      if (err["code"] === "EEXIST") {
        task.success(undefined);
      } else {
        task.error(err);
      }
    } else {
      task.success(undefined);
    }
  });
};

export const files_from_directory = (path) => (task) => {
  fs["readdir"](path, callback(task));
};

// TODO is it faster or slower to use `fs.stat` to check for a directory,
//      rather than relying upon the error message ?
export const files_from_directory_recursive = (file) => (task) => {
  const out = [];

  let pending = 0;

  let aborted = false;

  function loop(files, parent, prefix) {
    pending += files["length"];

    files["forEach"](function (file) {
      const new_parent = path["join"](parent, file);
      const new_prefix = path["join"](prefix, file);

      fs["readdir"](new_parent, function (err, files) {
        if (err) {
          if (err["code"] === "ENOTDIR") {
            if (!aborted) {
              out["push"](new_prefix);

              --pending;
              if (pending === 0) {
                task.success(out);
              }
            }

          } else {
            task.error(err);
          }

        } else if (!aborted) {
          --pending;
          loop(files, new_parent, new_prefix);
        }
      });
    });
  }

  fs["readdir"](file, function (err, files) {
    if (err) {
      task.error(err);

    } else if (!aborted) {
      loop(files, file, "");
    }
  });

  task.onAbort = (done) => {
    aborted = true;
    done();
  };
};
