import { _finally, _bind, concurrent, _void } from "../../FFI/Task";
import { make_stream, with_stream, some, none } from "../../FFI/Stream";
import { write_to_Node, read_from_Node } from "./util/stream";

const _child = require("child_process");


export const spawn = (cmd, args, opts) => {
  const child = _child["spawn"](cmd, args, {
    "stdio": [opts.stdin  || process["stdin"],
              opts.stdout || process["stdout"],
              opts.stderr || process["stderr"]]
  });

  let finished = false;
  let error = null;
  let status = null;
  let signal = null;

  child["on"]("error", (e) => {
    finished = true;
    error = e;
  });

  child["on"]("exit", (code, s) => {
    finished = true;
    status = code;
    signal = s;
  });

  const on_success = (code, signal, action) => {
    // TODO is this correct ?
    if (code === null) {
      // TODO Is it guaranteed that this only happens if we kill the process ?
      if (signal === "SIGTERM") {
        action.success(undefined);
      } else {
        action.error(new Error("Command \"" + cmd + "\" failed with signal " + signal));
      }

    } else if (code === 0 || opts.ignoreStatus) {
      action.success(undefined);

    } else {
      action.error(new Error("Command \"" + cmd + "\" failed with error code " + code));
    }
  };

  return {
    wait: (action) => {
      if (finished) {
        if (error !== null) {
          action.error(error);
        } else {
          on_success(status, signal, action);
        }

      } else {
        child["on"]("error", action.error);

        child["on"]("exit", (code, signal) => {
          on_success(code, signal, action);
        });

        action.onKilled = () => {
          // It's bad to kill a process after it's exited
          // https://nodejs.org/api/child_process.html#child_process_child_kill_signal
          if (!finished) {
            child["kill"]();
          }
        };
      }
    },

    stdin: child["stdin"],
    stdout: child["stdout"],
    stderr: child["stderr"]
  };
};


export const current_directory = (action) => {
  action.success(process["cwd"]());
};

const change_directory = (path) => (action) => {
  process["chdir"](path);
  action.success(undefined);
};

export const with_directory = (path, x) => (action) => {
  const cur = process["cwd"]();

  process["chdir"](path);

  _finally(x, change_directory(cur))(action);
};

// Strips out unnecessary stuff
export const _arguments = process["argv"]["slice"](2);

export const stdin =
  make_stream((output) =>
    read_from_Node(process["stdin"], output));

export const pipe_stdout = (input) =>
  with_stream(input, some, none, (input) =>
    write_to_Node(input, process["stdout"], { end: false }));

export const pipe_stderr = (input) =>
  with_stream(input, some, none, (input) =>
    write_to_Node(input, process["stderr"], { end: false }));

const spawn_pipe = (input, cmd, args, ignore_status) =>
  make_stream((output) =>
    with_stream(input, some, none, (input) => (action) => {
      const child = spawn(cmd, args, {
        stdin: "pipe",
        stdout: "pipe",
        ignoreStatus: ignore_status
      });

      // TODO ignore_concurrent
      // TODO does it need to wait for all 3 of these ?
      _bind(concurrent([
        child.wait,
        write_to_Node(input, child.stdin, { end: true }),
        read_from_Node(child.stdout, output)
      ]), (_) => _void)(action);
    }));

export const pipe = (input, cmd, args) =>
  spawn_pipe(input, cmd, args, false);

export const pipe_ignore_status = (input, cmd, args) =>
  spawn_pipe(input, cmd, args, true);
