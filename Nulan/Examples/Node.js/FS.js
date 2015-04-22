import { stream, push, pull, close } from "../Stream"; // "nulan:Stream"
import { _bind, run_root, run } from "../Task"; // "nulan:Task"

var fs = require("fs");
var path = require("path");


const close_error = (stream, e) => {
  // TODO is this correct ?
  run_root(_bind(close(stream), (_) => (task) => {
    task.error(e);
  }));
};

export const callback = (task) => (err, value) => {
  if (err) {
    task.error(err);
  } else {
    task.success(value);
  }
};


export const read_from_Node = (input, output) => (task) => {
  const cleanup = () => {
    console.log("read cleanup");
    input["removeListener"]("end", onEnd);
    input["removeListener"]("error", onError);
    input["removeListener"]("readable", onReadable);
  };

  const onEnd = () => {
    console.log("read onEnd");
    cleanup();
    // TODO is this correct ?
    run_root(close(output));
  };

  const onError = (e) => {
    console.log("read onError");
    cleanup();
    close_error(output, e);
  };

  const onReadable = () => {
    const chunk = input["read"]();
    console.log("read onReadable", chunk !== null);
    if (chunk !== null) {
      console.log("read chunk");
      // TODO is it possible for a "readable" event to trigger even if `chunk` is not `null` ?
      // TODO is it possible for onEnd to be called after the Stream is closed, and thus double-close it ?
      run(push(output, chunk), onReadable, onError, onEnd);
    }
  };

  input["setEncoding"]("utf8");

  input["on"]("end", onEnd);
  input["on"]("error", onError);
  input["on"]("readable", onReadable);

  onReadable();

  task.success(output);
};

export const write_to_Node = (input, output) => (task) => {
  const cleanup = () => {
    console.log("write cleanup");
    output["removeListener"]("finish", onFinish);
    output["removeListener"]("error", onError);
    output["removeListener"]("drain", onDrain);
  };

  const onFinish = () => {
    console.log("write onFinish");
    cleanup();
    // TODO is this correct ?
    run_root(close(input));
  };

  const onError = (e) => {
    console.log("write onError");
    cleanup();
    close_error(input, e);
  };

  const onCancel = () => {
    console.log("write onCancel");
    // TODO is this correct ?
    cleanup();
    // TODO is this correct ?
    output["end"]();
  };

  const onDrain = () => {
    console.log("write onDrain");
    run(pull(input), (value) => {
      if (output["write"](value, "utf8")) {
        console.log("write wrote");
        onDrain();
      } else {
        console.log("write wait");
      }
    }, onError, onCancel);
  };

  // TODO this doesn't work
  //output["setDefaultEncoding"]("utf8");

  output["on"]("finish", onFinish);
  output["on"]("error", onError);
  output["on"]("drain", onDrain);

  // TODO is this necessary ?
  onDrain();

  task.success(undefined);
};


const fs_open = (path, flags) => (task) => {
  fs["open"](path, flags, callback(task));
};

// TODO maybe have an `out` argument, rather than returning a new Stream
export const read_file = (path) =>
  _bind(fs_open(path, "r"), (fd) =>
    _bind(stream(), (output) =>
      read_from_Node(fs["createReadStream"](null, {
        "encoding": "utf8",
        "fd": fd
      }), output)));

export const write_file = (path, input) =>
  _bind(fs_open(path, "w"), (fd) =>
    write_to_Node(input, fs["createWriteStream"](null, {
      "encoding": "utf8",
      "fd": fd
    })));

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
  var out = [];

  var pending = 0;

  function loop(files, parent, prefix) {
    pending += files["length"];

    files["forEach"](function (file) {
      var new_parent = path["join"](parent, file);
      var new_prefix = path["join"](prefix, file);

      fs["readdir"](new_parent, function (err, files) {
        if (err) {
          if (err["code"] === "ENOTDIR") {
            out["push"](new_prefix);

            --pending;
            if (pending === 0) {
              task.success(out);
            }

          } else {
            task.error(err);
          }

        } else {
          --pending;
          loop(files, new_parent, new_prefix);
        }
      });
    });
  }

  fs["readdir"](file, function (err, files) {
    if (err) {
      task.error(err);
    } else {
      loop(files, file, "");
    }
  });
};
