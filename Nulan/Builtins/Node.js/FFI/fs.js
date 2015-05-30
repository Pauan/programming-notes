import { make_stream, with_stream, some, none } from "../../FFI/Stream"; // "nulan:Stream"
import { protect_kill, _finally } from "../../FFI/Task"; // "nulan:Task"
import { callback } from "./util/util";
import { fs_readStream, fs_writeStream, read_from_Node, write_to_Node } from "./util/stream";
import { fs_open, fs_close, fs_symlink, fs_mkdir, fs_rename_safe } from "./util/fs";
import { fs_copy } from "./util/copy";
import { fs_remove } from "./util/remove";
import { fs_files, fs_files_recursive } from "./util/files";
import { fs_replace_file } from "./util/replace";
import { fs_make_temporary_directory } from "./util/temporary";


const open = (path, flags) => (action) => {
  fs_open(path, flags, callback(action));
};

const close = (fd) => (action) => {
  fs_close(fd, callback(action));
};

const with_open = (path, flags, f) =>
  protect_kill(open(path, flags), close, (fd) =>
    _finally(f(fd), close(fd)));


// TODO what if it starts reading a file at the same time as another process is writing to the same file ?
export const read_file = (path) =>
  make_stream((output) =>
    with_open(path, "r", (fd) =>
      read_from_Node(fs_readStream(fd), output)));

export const make_file = (input, path) =>
  with_stream(input, some, none, (input) =>
    with_open(path, "wx", (fd) =>
      write_to_Node(input, fs_writeStream(fd), { end: true })));

export const make_symlink = (from, to) => (action) => {
  fs_symlink(from, to, callback(action));
};

export const make_directory = (path) => (action) => {
  fs_mkdir(path, callback(action));
};

// TODO handle being killed
// TODO what if there are readers for `path`?
export const remove = (path) => (action) => {
  fs_remove(path, callback(action));
};

// TODO handle being killed
export const move = (from, to) => (action) => {
  fs_rename_safe(from, to, callback(action));
};

// TODO handle being killed
export const copy = (from, to) => (action) => {
  fs_copy(from, to, callback(action));
};

export const files_in_directory = (path) =>
  make_stream((output) =>
    fs_files(output, path));

// TODO handle being killed
export const all_files_in_directory = (path) =>
  make_stream((output) =>
    fs_files_recursive(output, path));

const make_temporary_directory = (action) => {
  fs_make_temporary_directory(callback(action));
};

export const with_temporary_directory = (f) =>
  protect_kill(make_temporary_directory, remove, (path) =>
    _finally(f(path), remove(path)));

// TODO handle being killed
export const replace_file = (from, to) => (action) => {
  fs_replace_file(from, to, callback(action));
};
