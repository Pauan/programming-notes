import { random_chars } from "./random";
import { fs_mkdir } from "./fs";

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

export const fs_make_temporary_directory = (cb) => {
  temporary_path((err, path) => {
    if (err) {
      cb(err);

    } else {
      fs_mkdir(path, 448 /* 0700 */, (err) => {
        if (err) {
          if (err["code"] === "EEXIST") {
            fs_make_temporary_directory(cb);
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
