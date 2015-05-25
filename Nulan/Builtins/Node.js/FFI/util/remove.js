import { unlink, readdir, rmdir } from "./fs";
import { waitfor } from "./util";

const _path = require("path");


export const remove = (path, cb) => {
  // There's more files than directories, so try unlink first
  unlink(path, (err) => {
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
  readdir(path, (err, files) => {
    if (err) {
      cb(err);

    } else if (files["length"]) {
      const callback = waitfor(files["length"], (err) => {
        if (err) {
          cb(err);
        } else {
          rmdir(path, cb);
        }
      });

      files["forEach"]((file) => {
        remove(_path["join"](path, file), callback);
      });

    } else {
      rmdir(path, cb);
    }
  });
};


/*console.log("STARTING");

remove("/home/pauan/Scratch/tmp/foo-dir", (err) => {
  if (err) {
    console.log(err.stack);
  }

  console.log("ENDING");
});
*/
