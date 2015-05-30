import { make_stream, with_stream, some, none } from "../../FFI/Stream"; // "nulan:Stream"
import { protect_terminate, _finally } from "../../FFI/Task"; // "nulan:Task"
import { callback } from "./util/util";
import { fs_readStream, fs_writeStream, read_from_Node, write_to_Node } from "./util/stream";
import { open, close, symlink, mkdir, rename_safe } from "./util/fs";
import { copy } from "./util/copy";
import { remove } from "./util/remove";
import { files, files_recursive } from "./util/files";
import { replace_file } from "./util/replace";
import { make_temporary_directory } from "./util/temporary";


/*export const String_to_Char = (stream) =>
  make_stream((output) =>
    with_stream(stream, some, none, (input) => {
      const pusher = (s, i) =>
        (i < s["length"]
          ? _bind(push(output, s[i]), (_) => pusher(s, i + 1))
          : loop());

      const loop = () =>
        _bind(pull(input), (value) =>
          (value["length"]
            ? pusher(value[0], 0)
            : _void));

      return loop();
    }));*/

const fs_open = (path, flags) => (action) => {
  open(path, flags, callback(action));
};

const fs_close = (fd) => (action) => {
  close(fd, callback(action));
};

const fs_with_open = (path, flags, f) =>
  protect_terminate(fs_open(path, flags), fs_close, (fd) =>
    _finally(f(fd), fs_close(fd)));


// TODO what if it starts reading a file at the same time as another process is writing to the same file ?
export const fs_read_file = (path) =>
  make_stream((output) =>
    fs_with_open(path, "r", (fd) =>
      read_from_Node(fs_readStream(fd), output)));

/*export const write_file = (path, input) =>
  with_stream(input, some, none, (input) =>
    with_temporary_file((tmp_path, fd) =>
      _bind(write_to_Node(input, fs_writeStream(fd), { end: true }), (_) =>
        replace_file(fd, tmp_path, path))));*/

export const fs_make_file = (input, path) =>
  with_stream(input, some, none, (input) =>
    fs_with_open(path, "wx", (fd) =>
      write_to_Node(input, fs_writeStream(fd), { end: true })));

export const fs_make_symlink = (from, to) => (action) => {
  symlink(from, to, callback(action));
};

export const fs_make_directory = (path) => (action) => {
  mkdir(path, callback(action));
};

// TODO handle termination
// TODO what if there are readers for `path`?
export const fs_remove = (path) => (action) => {
  remove(path, callback(action));
};

// TODO handle termination
export const fs_rename = (from, to) => (action) => {
  rename_safe(from, to, callback(action));
};

export const fs_copy = (from, to) => (action) => {
  copy(from, to, callback(action));
};

export const fs_files = (path) =>
  make_stream((output) =>
    files(output, path));

export const fs_files_recursive = (path) =>
  make_stream((output) =>
    files_recursive(output, path));

const fs_make_temporary_directory = (action) => {
  make_temporary_directory(callback(action));
};

export const fs_with_temporary_directory = (f) =>
  protect_terminate(fs_make_temporary_directory, fs_remove, (path) =>
    _finally(f(path), fs_remove(path)));

export const fs_replace_file = (from, to) => (action) => {
  replace_file(from, to, callback(action));
};
