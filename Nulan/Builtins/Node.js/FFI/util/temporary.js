import { random_chars } from "./random";
import { mkdir } from "./fs";

const _fs   = require("fs");
const _path = require("path");


const _tmp = require("os")["tmpdir"]();

const temporary_path = (f) => {
  random_chars(16, (err, x) => {
    if (err) {
      f(err, x);
    } else {
      f(err, _path["join"](_tmp, "tmp-" + x));
    }
  });
};

/*export const make_temporary_file = (action) => {
  temporary_path((err, path) => {
    if (err) {
      action.error(err);

    } else {
      _fs["open"](path, "wx", 384 /* 0600 *//*, (err, fd) => {
        if (err) {
          if (err["code"] === "EEXIST") {
            temporary_file(action);
          } else {
            action.error(err);
          }
        } else {
          action.success([path, fd]);
        }
      });
    }
  });
};*/

export const make_temporary_directory = (cb) => {
  temporary_path((err, path) => {
    if (err) {
      cb(err);

    } else {
      mkdir(path, 448 /* 0700 */, (err) => {
        if (err) {
          if (err["code"] === "EEXIST") {
            make_temporary_directory(cb);
          } else {
            cb(err);
          }
        } else {
          cb(null, path);
        }
      });
    }
  });
};

/*const cleanup_temporary_file = (path, fd) =>
  _finally(fs_close(fd), fs_unlink_safe(path));

export const with_temporary_file = (f) =>
  protect_terminate(temporary_file,
    ([path, fd]) =>
      cleanup_temporary_file(path, fd),
    ([path, fd]) =>
      _finally(f(path, fd), cleanup_temporary_file(path, fd)));
*/
