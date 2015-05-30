import { fs_unlink, fs_readdir, fs_rmdir } from "./fs";
import { waitfor } from "./util";

const _path = require("path");


export const fs_remove = (path, cb) => {
  // There's more files than directories, so try unlink first
  fs_unlink(path, (err) => {
    if (err) {
      if (err["code"] === "EISDIR") {
        remove_recursive(path, cb);

      } else {
        cb(err);
      }

    } else {
      cb(err);
    }
  });
};

const remove_recursive = (path, cb) => {
  // There's more directories with files than without, so try readdir first
  fs_readdir(path, (err, files) => {
    if (err) {
      cb(err);

    } else if (files["length"]) {
      const callback = waitfor(files["length"], (err) => {
        if (err) {
          cb(err);
        } else {
          fs_rmdir(path, cb);
        }
      });

      files["forEach"]((file) => {
        fs_remove(_path["join"](path, file), callback);
      });

    } else {
      fs_rmdir(path, cb);
    }
  });
};
