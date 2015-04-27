import { run_root, _bind, _finally, on_cancel, ignore, success, log, concurrent, thread, delay, fastest, thread_kill, run } from "../FFI/Task";
import { push, pull, close, stream_fixed } from "../FFI/Stream";
import { read_file, write_file, files_from_directory_recursive } from "../Node.js/FFI/fs";
import { is_hidden_file } from "../Node.js/FFI/path";


const debug = (s, x) => {
  console.log(s);
  return x;
};

const _void = () => undefined;

const ignore_concurrent = (a) =>
  ignore(concurrent(a));

const stream = () => stream_fixed(5);

const forever = (task) =>
  _bind(task, (_) => forever(task));

const with_stream = (task) =>
  on_cancel(ignore(task), success(_void()));

const stream_each = (_in, f) =>
  with_stream(forever(_bind(pull(_in), f)));

const stream_foldl = (init, _in, f) => {
  const next = (old) =>
    on_cancel(_bind(pull(_in), (value) =>
              _bind(f(old, value), next)),
              success(old));
  return next(init);
};

const copy_file = (from, to) =>
  _bind(stream(), (s) =>
    ignore_concurrent([read_file(from, s), write_file(s, to)]));

const current_time = (task) => {
  task.success(Date.now());
};

const benchmark = (t) => {
  const end = Date["now"]() + 10000;
  const next = (i) => {
    if (Date["now"]() < end) {
      return _bind(t, (_) => next(i + 1));
    } else {
      return success(i);
    }
  };
  return next(0);
};


//////////////////////////////////////////////////////////////////////////////


const generate_add = (out) => {
  const next = (i) =>
    _bind(push(out, i), (_) =>
      next(i + 1));
  return with_stream(next(0));
};

const generate_multiply = (out) => {
  const next = (i) =>
    _bind(push(out, i), (_) =>
      next(i * 2));
  return with_stream(next(1));
};

/*const accumulate = (_in) =>
  stream_foldl(0, _in, (old, value) => {
    const _new = old + value;
    return _bind(log(_new), (_) => success(_new));
  });*/

const accumulate = (_in) =>
  stream_foldl(0, _in, (old, value) =>
    success(old + value));


const log_current_time = (max) => {
  const next = (i) => {
    if (i < max) {
      return _bind(current_time, (now) =>
        _bind(log(now), (_) => next(i + 1)));

    } else {
      return success(_void());
    }
  };
  return next(0);
};


const increment = (i) =>
  _bind(log(i), (_) => increment(i + 1));


//////////////////////////////////////////////////////////////////////////////


/*const main = () =>
  success(_void());*/

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
  fastest([increment(0),
           delay(1000)]);*/

const main = () =>
  _bind(benchmark(copy_file("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo")), log);

/*const main = () =>
  forever(_bind(current_time, log));*/

/*const main = () =>
  forever(log_current_time(10));*/

/*const main = () =>
  fastest([log_current_time(10),
           success(5)]);*/

/*const t = run(_finally(success(1), success(2)), () => {}, () => {}, () => {});

setTimeout(() => {
  console.log(t._state);
  t.abort(() => {
    console.log(t._state);
  });
}, 2000);*/

/*run(ignore(success(10))).abort(() => {
  console.log("DONE");
});*/

/*const main = () =>
  _bind(stream_fixed(5), (s) =>
    ignore_concurrent([read_file("/home/pauan/Scratch/2014-09-30", s),
                       stream_each(s, (x) => log(x))]));*/

/*const main = () =>
  copy_file("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo");*/

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

// browserify --transform babelify Nulan/Examples/Test/Test.js --outfile Nulan/Examples/Test/Test.build.js
run_root(main);
