import { run_root, _bind, _finally, on_cancel, ignore, success, log, concurrent, thread } from "./FFI/Task";
import { push, pull, close, stream_fixed } from "./FFI/Stream";
import { read_file, write_file } from "./Node.js/FFI/FS";

const _void = () => undefined;

const ignore_concurrent = (a) =>
  ignore(concurrent(a));

const forever = (task) =>
  _bind(task, (_) => forever(task));

const with_in_stream = (task) =>
  on_cancel(ignore(task), success(_void()));

const with_out_stream = (out, task) =>
  _finally(with_in_stream(task), close(out));

const stream_each = (_in, f) =>
  with_in_stream(forever(_bind(pull(_in), (value) => f(value))));

const pipe = (from, to) =>
  with_out_stream(to, stream_each(from, (value) => push(to, value)));

const copy_file = (from, to) =>
  _bind(stream_fixed(5), (s) =>
    ignore_concurrent([read_file(from, s), write_file(s, to)]));

const now = (task) =>
  task.success(Date.now());


/*run_root(_bind(stream_fixed(1), (s) =>
         concurrent([forever(push(s, 1)),
                     forever(pull(s))])));*/

/*run_root(_bind(stream_fixed(1), (s) =>
         _bind(thread(forever(push(s, 1))), (_) =>
               thread(forever(pull(s))))));*/

//run_root(forever(_bind(now, (now) => log(now))));

/*run_root(_bind(stream_fixed(5), (s) =>
  ignore_concurrent([read_file("/home/pauan/Scratch/2014-09-30", s),
                     stream_each(s, (x) => log(x))])));*/

run_root(copy_file("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo"));
