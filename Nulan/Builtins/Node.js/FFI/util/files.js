import { each_array } from "./util";
import { fs_readdir } from "./fs";
import { push_Array } from "./stream";
import { push } from "../../../FFI/Stream"; // "nulan:Stream"
import { _bind, on_error, _error } from "../../../FFI/Task"; // "nulan:Task"

const _path = require("path");


const readdir_sorted = (path) => (action) => {
  let killed = false;

  action.onKilled = () => {
    killed = true;
  };

  fs_readdir(path, (err, files) => {
    if (err) {
      action.error(err);
    } else if (!killed) {
      action.success(files["sort"]());
    }
  });
};


export const fs_files = (output, path) =>
  _bind(readdir_sorted(path), (files) =>
    each_array(files, (file) =>
      push(output, file)));

const push_files_recursive = (output, path, top, files) =>
  each_array(files, (value) => {
    const file    = _path["join"](path, value);
    const new_top = _path["join"](top, value);

    return on_error(readdir_sorted(file),
             (err) =>
               (err["code"] === "ENOTDIR"
                 ? push(output, new_top)
                 : _error(err)),

             (files) =>
               push_files_recursive(output, file, new_top, files));
  });

export const fs_files_recursive = (output, path) =>
  _bind(readdir_sorted(path), (files) =>
    push_files_recursive(output, path, "", files));
