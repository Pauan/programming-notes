import { _void, run_root, _bind, success, make_error, _error, log, never, concurrent, protect_kill, _finally, fastest, run_thread, sequential, noop, run } from "../FFI/Task";
import { delay, current_time } from "../FFI/Time";
import { pull, make_stream, with_stream, push, some, none } from "../FFI/Stream";
import { read_file, make_file, files_in_directory, all_files_in_directory, remove, copy, move, replace_file, with_temporary_directory } from "../Node.js/FFI/fs";
import { path, is_hidden_file } from "../Node.js/FFI/path";
import { pipe, pipe_ignore_status, _arguments, stdin, pipe_stdout } from "../Node.js/FFI/script";


const debug = (s, x) => {
  console["log"](s);
  return x;
};


const thread = (task) => (action) => {
  run_thread(task);
  action.success(undefined);
};


// Task.adoc
const ignore = (x) =>
  _bind(x, (_) => _void);

const ignore_concurrent = (a) =>
  ignore(concurrent(a));

const ignore_sequential = (a) =>
  ignore(sequential(a));

const forever = (task) =>
  _bind(task, (_) => forever(task));

const error = (s) =>
  _error(make_error(s));


// Time.adoc
const timeout = (task, ms) =>
  fastest([task, delay(ms)]);

const benchmark = (task) =>
  _bind(current_time, (now) => {
    const end = now + 10000;
    const next = (i) =>
      _bind(current_time, (now) => {
        if (now < end) {
          return _bind(task, (_) => next(i + 1));
        } else {
          return success(i);
        }
      });
    return next(0);
  });


// Stream.adoc
const empty = () =>
  make_stream((_) => _void);

const concat = (s) =>
  make_stream((out) =>
    ignore_sequential(s["map"]((s) =>
      each(s, (value) =>
        push(out, value)))));

const drain_output = (_in) => {
  const loop = () =>
    _bind(pull(_in), (u) =>
      (u["length"]
        ? loop()
        : _void));
  return loop();
};

const each_output = (_in, f) => {
  const loop = () =>
    _bind(pull(_in), (u) =>
      (u["length"]
        ? _bind(f(u[0]), (_) => loop())
        : _void));
  return loop();
};

const push_drain = (_in, out, value) =>
  fastest([
    push(out, value),
    _bind(drain_output(_in), (_) =>
      never)
  ]);

const drain = (_in) =>
  with_stream(_in, some, none, drain_output);

const each = (_in, f) =>
  with_stream(_in, some, none, (_in) =>
    each_output(_in, f));

const throttle = (_in, ms) =>
  make_stream((out) =>
    with_stream(_in, some, none, (_in) =>
      each_output(_in, (value) =>
        ignore_concurrent([
          push_drain(_in, out, value),
          timeout(drain_output(_in), ms)
        ]))));

const dropping = (_in) =>
  make_stream((out) =>
    with_stream(_in, some, none, (_in) =>
      each_output(_in, (value) =>
        push_drain(_in, out, value))));

const merge = (s) =>
  make_stream((out) =>
    ignore_concurrent(s["map"]((s) =>
      each(s, (value) =>
        push(out, value)))));

const stream_foldl = (s, init, f) =>
  with_stream(s, some, none, (_in) => {
    const next = (old) =>
      _bind(pull(_in), (u) =>
        (u["length"]
          ? _bind(f(old, u[0]), next)
          : success(old)));
    return next(init);
  });

const stream_length = (s) =>
  stream_foldl(s, 0, (old, _) => success(old + 1));

const map = (_in, f) =>
  make_stream((out) =>
    each(_in, (value) =>
      push(out, f(value))));

const generate = (init, f) =>
  make_stream((out) => {
    const next = (x) =>
      _bind(push(out, x), (_) =>
        next(f(x)));
    return next(init);
  });


// fs.adoc
const copy_file = (from, to) =>
  make_file(read_file(from), to);

const with_temporary_path = (f) =>
  with_temporary_directory((dir) =>
    f(path([dir, "tmp"])));

const map_file = (file, f) =>
  with_temporary_path((x) =>
    _bind(make_file(f(read_file(file)), x), (_) =>
      replace_file(x, file)));


//////////////////////////////////////////////////////////////////////////////


const generate_add = (init, inc) =>
  generate(init, (x) => x + inc);

const generate_multiply = (init, inc) =>
  generate(init, (x) => x * inc);

const accumulate = (_in) =>
  stream_foldl(_in, 0, (old, value) => {
    const _new = old + value;
    return _bind(log(_new), (_) => success(_new));
  });


const log_current_time = (max) => {
  const next = (i) => {
    if (i < max) {
      return _bind(current_time, (now) =>
        _bind(log(now), (_) => next(i + 1)));

    } else {
      return _void;
    }
  };
  return next(0);
};


const zero =
  make_stream((out) =>
    forever(push(out, 0)));

const one =
  make_stream((out) =>
    forever(push(out, 1)));

const increment = (i) =>
  _bind(log(i), (_) => increment(i + 1));

const push1 = (s) =>
  make_stream((out) => push(out, s));

const pull1 = (s) =>
  with_stream(s, some, none, (s) =>
    ignore(pull(s)));

const test_events = make_stream((out) => (action) => {
  for (let i = 0; i < 40; ++i) {
    setInterval(() => {
      const t = run(push(out, 0), noop, action.error);

      action.onKilled = () => {
        t.kill();
      };
    }, 0);
  }
});

const test_delays = make_stream((out) =>
  forever(
    _bind(push(out, 1), (_) =>
    _bind(delay(1000), (_) =>
    _bind(push(out, 2), (_) =>
    _bind(push(out, 3), (_) =>
    _bind(push(out, 4), (_) =>
    _bind(delay(150), (_) =>
    _bind(push(out, 5), (_) =>
    _bind(delay(150), (_) =>
    _bind(push(out, 6), (_) =>
    _bind(delay(300), (_) =>
    _bind(push(out, 7), (_) =>
    _bind(delay(398), (_) =>
    _bind(push(out, 8), (_) =>
    _bind(delay(1500), (_) =>
    _bind(push(out, 9), (_) =>
    _bind(delay(2000), (_) =>
    _bind(push(out, 10), (_) =>
    _bind(delay(999), (_) =>
    _bind(push(out, 11), (_) =>
    _bind(delay(1001), (_) =>
          push(out, 12)))))))))))))))))))))));
/*
1
3
8
9
10
12
2
9
10
12
2
8
9
10
12
*/

//////////////////////////////////////////////////////////////////////////////


const main = () =>
  each(dropping(generate_add(0, 1)), log);

/*const main = () =>
  each(throttle(test_events, 1000), log);*/

/*const main = () =>
  each(throttle(generate_add(0, 1), 1000), log);*/

/*const main = () =>
  stream_foldl(throttle(generate_add(0, 1), 1000), Date["now"](), (old, value) => {
    const now = Date["now"]();
    console.log(now - old);
    return success(now);
  });*/

/*const main = () =>
  each(throttle(test_delays, 1000), log);*/

/*const main = () =>
  with_stream(make_stream((s) => push(s, 5)), some, none, (s) => _bind(delay(1000), (_) => pull(s)));*/

/*const main = () =>
  with_stream(make_stream((s) => _bind(push(s, 5), (_) => push(s, 10))), some, none, (s) => _void);*/

/*const main = () =>
  with_stream(make_stream((_) => never), some, none, (_) => _void);*/

/*const main = () =>
  with_stream(make_stream((_) => _void), some, none, (_) => never);*/

/*const main = () =>
  each(make_stream((s) => forever(push(s, 5))), (_) => _void);*/

/*const main = () =>
  with_stream(make_stream((_) => error("foo")), some, none, (_) => _void);*/

/*const main = () =>
  with_stream(make_stream((_) => _void), some, none, (_) => error("foo"));*/

/*const main = () =>
  with_stream(make_stream((_) => _bind(delay(1000), (_) => error("foo"))), some, none, (_) => _void);*/

/*const main = () =>
  with_stream(make_stream((_) => _void), some, none, (_) => _bind(delay(1000), (_) => error("foo")));*/

/*const main = () =>
  with_stream(make_stream((_) => protect_kill(error("foo"), (_) => _void, (_) => _void)), some, none, (_) => _void);*/

/*const main = () =>
  with_stream(make_stream((_) => protect_kill(_bind(delay(1000), (_) => error("foo")), (_) => _void, (_) => _void)), some, none, (_) => _void);*/

/*const main = () =>
  with_stream(make_stream((s) => forever(push(s, 5))), some, none, (s) => {
    const next = () =>
      _bind(pull(s), (v) => {
        if (v["length"]) {
          return next();
        } else {
          return _void;
        }
      });
    return next();
  });*/


//////////////////////////////////////////////////////////////////////////////

/*const main = () =>
  pull1(map(one, (value) => value + 1));*/

/*const main = () =>
  pull1(pipe(push1("foo"), "grep", ["foo"]));*/

/*const main = () =>
  each(pipe(empty(), "ls", []), log);*/

/*const main = () =>
  pipe_stdout(pipe(empty(), "ls", []));*/

/*const main = () =>
  pipe_stdout(merge([pipe(empty(), "echo", ["hello"]),
                     pipe(empty(), "echo", ["world"])]));*/

/*const main = () =>
  pipe_stdout(pipe(pipe_ignore_status(pipe(empty(),
    "find", [_arguments[0], "-type", "f", "-print0"]),
    "xargs", ["-0", "grep", "foo"]),
    "wc", ["-l"]));*/


//////////////////////////////////////////////////////////////////////////////


/*const main = () =>
  ignore_concurrent([
    copy("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo-file"),
    copy("/home/pauan/Scratch/programming-notes", "/home/pauan/Scratch/tmp/foo-dir"),
    copy("/home/pauan/bin/browserify", "/home/pauan/Scratch/tmp/foo-symlink")
  ]);*/

/*const main = () =>
  remove("/home/pauan/Scratch/tmp/foo-dir");*/


//////////////////////////////////////////////////////////////////////////////


/*const main = () =>
  ignore_concurrent([
    pipe_stdout(map(zero, (v) => "" + v)),
    pipe_stdout(map(one, (v) => "" + v))
  ]);*/

/*const main = () =>
  ignore_concurrent([
    each(stdin, (v) => log("1 " + v)),
    each(stdin, (v) => log("2 " + v))
  ]);*/

//const main = () => _void;

//run_thread(_finally(_void, _void)).kill();

/*const main = () =>
  each(merge([one, zero]), log);*/

/*const main = () =>
  accumulate(merge([generate_add(0, 1),
                    generate_multiply(1, 2)]));*/

/*const main = () =>
  forever(success(5));*/

/*const main = () =>
  _bind(stream_fixed(1), (s) =>
    concurrent([forever(push(s, 1)),
                forever(pull(s))]));*/

/*const main = () =>
  _bind(stream_fixed(1), (s) =>
    _bind(thread(forever(push(s, 1))), (_) =>
      thread(forever(pull(s)))));*/

//const main = () => increment(0);

/*const main = () =>
  fastest([forever(_bind(current_time, log)),
           delay(1000)]);*/

/*const main = () =>
  _bind(current_time, (now1) =>
    _bind(current_time, (now2) =>
      _bind(log(now1), (_) =>
        _bind(log(now2), (_) =>
          error("hiya")))));*/

/*const main = () =>
  thread(never());*/

/*const main = () =>
  _bind(thread(forever(log("a"))), (_) =>
    forever(log("b")));*/

/*const main = () =>
  with_stream(read_file("/home/pauan/Scratch/2014-09-30"), some, none, (_) => _void);*/

/*const main = () =>
  copy_file("/home/pauan/Scratch/tmp/foo", "/home/pauan/Scratch/tmp/foo");*/

/*const main = () =>
  copy_file("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo");*/

/*const main = () =>
  map_file("/home/pauan/Scratch/tmp/foo", (s) =>
    map(s, (s) => s["toLocaleUpperCase"]()));*/

/*const main = () =>
  make_file("/home/pauan/Scratch/tmp/foo",
    map(read_file("/home/pauan/Scratch/tmp/foo"), (s) =>
      s["toLocaleUpperCase"]()));*/

/*const main = () =>
  move("/home/pauan/Scratch/tmp/foo", "/home/pauan/Scratch/tmp/foo3");*/

/*const main = () =>
  with_stream(files_in_directory("/home/pauan/Downloads"), some, none, (s) => log("foo"));*/

/*const main = () =>
  with_stream(all_files_in_directory("/home/pauan/Downloads"), some, none, (s) => _bind(pull(s), log));*/

/*const main = () =>
  _bind(delay(1000), (_) =>
    error("Hiya"));*/

/*const main = () =>
  _bind(stream_length(all_files_in_directory("/home/pauan/Downloads")), log);*/

/*const main = () =>
  fastest([_void, forever(log("1"))]);*/

/*const main = () =>
  _bind(benchmark(_bind(remove("/home/pauan/Scratch/tmp/foo"), (_) =>
                    copy("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo"))), log);*/

/*let i = 1013;
while (i--) {
  require("fs")["open"]("/home/pauan/Scratch/tmp/foo", "r", (err, fd) => {
    if (err) {
      console.error(err);
    }
  });
}

const main = () => _bind(all_files_in_directory("/home/pauan/Downloads"), log);*/

//const s = make_stream((push) => _bind(push("5"), (_) => push("10")));

/*const main = () =>
  forever(thread(with_stream(read_file("/home/pauan/Scratch/tmp/foo.js"), some, none, (_) => _void)));*/

/*const main = () =>
  forever(thread(read_file("/home/pauan/Scratch/tmp/foo.js")));*/

/*const main = () =>
  forever(_bind(current_time, log));*/

/*const main = () =>
  forever(log_current_time(10));*/

/*const main = () =>
  fastest([log_current_time(10),
           success(5)]);*/

/*const t = run(_finally(success(1), success(2)), () => {}, () => {});

setTimeout(() => {
  console.log(t._state);
  t.abort(() => {
    console.log(t._state);
  });
}, 2000);*/

//run(ignore(success(10))).kill();

/*const main = () =>
  each(read_file("/home/pauan/Scratch/2014-09-30"), log);*/

/*const main = () =>
  _bind(all_files_in_directory("/home/pauan/Scratch"), (a) =>
    log(a.filter((x) => !is_hidden_file(x))));*/

/*const main = () =>
  _bind(stream(), (x) =>
    ignore_concurrent([
      generate_add(x),

      generate_multiply(x),

      accumulate(x),

      _bind(delay(1000), (_) =>
        debug("CLOSING", close(x)))
    ]));*/

// babel-node Nulan/Examples/Test/Test.js
// browserify --transform babelify Nulan/Examples/Test/Test.js --outfile Nulan/Examples/Test/Test.build.js
run_root(main);
