import { waitfor, pend, unpend } from "./util";
import { lstat, readdir, utimes, mkdir, symlink, realpath, chown } from "./fs";

const _fs   = require("fs");
const _path = require("path");


export const copy = (from, to, cb) => {
  lstat(from, (err, stat) => {
    if (err) {
      cb(err);

    } else if (stat["isDirectory"]()) {
      copy_directory(from, to, stat, cb);

    } else if (stat["isFile"]()) {
      copy_file(from, to, stat, cb);

    } else if (stat["isSymbolicLink"]()) {
      copy_symlink(from, to, stat, cb);

    } else {
      cb(new Error("Invalid file type: \"" + from + "\""));
    }
  });
};

const copy_children = (from, to, cb) => {
  readdir(from, (err, files) => {
    if (err) {
      cb(err);

    } else if (files["length"]) {
      const all = waitfor(files["length"], cb);

      files["forEach"]((file) => {
        copy(_path["join"](from, file), _path["join"](to, file), all);
      });

    } else {
      cb(null);
    }
  });
};


const sync_stats = (path, stat, cb) => {
  // TODO use lutimes
  utimes(path, stat["atime"], stat["mtime"], (err) => {
    if (err) {
      cb(err);
    } else {
      // TODO use lchown
      chown(path, stat["uid"], stat["gid"], cb);
    }
  });
};

const pipe_file = (from, to, mode, cb) => {
  pend(() => {
    _fs["open"](from, "r", mode, (err, read_fd) => {
      if (err) {
        unpend();
        cb(err);

      } else {
        _fs["open"](to, "wx", mode, (err, write_fd) => {
          if (err) {
            _fs["close"](read_fd, (err2) => {
              unpend();

              if (err2) {
                cb(err2);
              } else {
                cb(err);
              }
            });

          } else {
            const read  = _fs["createReadStream"](null, { "fd": read_fd });
            const write = _fs["createWriteStream"](null, { "fd": write_fd });

            let errored = false;

            const callback = waitfor(2, (err) => {
              unpend();

              // TODO test this
              if (err || !errored) {
                cb(err);
              }
            });

            read["on"]("error", (err) => {
              errored = true;
              // TODO test this
              write["destroy"]();
              cb(err);
            });

            write["on"]("error", (err) => {
              errored = true;
              // TODO test this
              read["destroy"]();
              cb(err);
            });

            read["on"]("close", callback);
            write["on"]("close", callback);

            read["pipe"](write);
          }
        });
      }
    });
  });
};

const copy_file = (from, to, stat, cb) => {
  pipe_file(from, to, stat["mode"], (err) => {
    if (err) {
      cb(err);
    } else {
      sync_stats(to, stat, cb);
    }
  });
};

const copy_directory = (from, to, stat, cb) => {
  mkdir(to, stat["mode"], (err) => {
    if (err) {
      cb(err);

    } else {
      copy_children(from, to, (err) => {
        if (err) {
          cb(err);
        } else {
          sync_stats(to, stat, cb);
        }
      });
    }
  });
};

const make_symlink = (from, to, stat, cb) => {
  symlink(from, to, (err) => {
    if (err) {
      cb(err);

    } else {
      sync_stats(from, stat, cb);
    }
  });
};

const copy_symlink = (from, to, stat, cb) => {
  realpath(from, (err, target) => {
    if (err) {
      cb(err);

    } else {
      make_symlink(to, target, stat, cb);
    }
  });
};



/*copy("/home/pauan/Scratch/2014-09-30", "/home/pauan/Scratch/tmp/foo-file", (err) => {
  if (err) {
    console.log(err.stack);
  }
});*/

/*console.log("STARTING");

copy("/home/pauan/Scratch/programming-notes", "/home/pauan/Scratch/tmp/foo-dir", (err) => {
  if (err) {
    console.log(err.stack);
  }

  console.log("ENDING");
});*/

/*copy("/home/pauan/bin/browserify", "/home/pauan/Scratch/tmp/foo-symlink", (err) => {
  if (err) {
    console.log(err.stack);
  }
});*/
