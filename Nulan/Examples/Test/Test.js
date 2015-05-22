import { _void, run_root, _bind, success, error, log, never, concurrent, protect_terminate, _finally, fastest, run_thread } from "../FFI/Task";
import { delay, current_time } from "../FFI/Time";
import { pull, make_stream, with_stream, push, some, none } from "../FFI/Stream";
import { read_file, write_file, files_from_directory_recursive } from "../Node.js/FFI/fs";
import { is_hidden_file } from "../Node.js/FFI/path";


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

const forever = (task) =>
  _bind(task, (_) => forever(task));


// Time.adoc
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
const each = (s, f) =>
  with_stream(s, some, none, (_in) => {
    const next = () =>
      _bind(pull(_in), (u) => {
        if (u["length"]) {
          return _bind(f(u[0]), (_) => next());
        } else {
          return _void;
        }
      });
    return next();
  });

const merge = (s) =>
  make_stream((out) =>
    ignore_concurrent(s["map"]((s) =>
      each(s, (value) =>
        push(out, value)))));

const foldl = (init, s, f) =>
  with_stream(s, some, none, (_in) => {
    const next = (old) =>
      _bind(pull(_in), (u) => {
        if (u["length"]) {
          return _bind(f(old, u[0]), next);
        } else {
          return success(old);
        }
      });
    return next(init);
  });

const generate = (init, f) =>
  make_stream((out) => {
    const next = (x) =>
      _bind(push(out, x), (_) =>
        next(f(x)));
    return next(init);
  });


// fs.adoc
const copy_file = (from, to) =>
  write_file(to, read_file(from));


//////////////////////////////////////////////////////////////////////////////


const generate_add = (init, inc) =>
  generate(init, (x) => x + inc);

const generate_multiply = (init, inc) =>
  generate(init, (x) => x * inc);

const accumulate = (_in) =>
  foldl(0, _in, (old, value) => {
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


//////////////////////////////////////////////////////////////////////////////


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
  with_stream(make_stream((_) => protect_terminate(error("foo"), (_) => _void, (_) => _void)), some, none, (_) => _void);*/

/*const main = () =>
  with_stream(make_stream((_) => protect_terminate(_bind(delay(1000), (_) => error("foo")), (_) => _void, (_) => _void)), some, none, (_) => _void);*/

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


//run_thread(_finally(_void, _void)).terminate();

/*const main = () =>
  each(merge([one, zero]), log);*/

/*const main = () =>
  accumulate(merge([generate_add(0, 1),
                    generate_multiply(1, 2)]));*/

//const main = () => _void;

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

const main = () =>
  _bind(benchmark(copy_file("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo")), log);

/*const main = () =>
  copy_file("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo");*/

/*let i = 1013;
while (i--) {
  require("fs")["open"]("/home/pauan/Scratch/tmp/foo", "r", (err, fd) => {
    if (err) {
      console.error(err);
    }
  });
}

const main = () => _bind(files_from_directory_recursive("/home/pauan/Downloads"), log);*/

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

//run(ignore(success(10))).terminate();

/*const main = () =>
  each(read_file("/home/pauan/Scratch/2014-09-30"), log);*/

/*const main = () =>
  _bind(files_from_directory_recursive("/home/pauan/Scratch"), (a) =>
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
