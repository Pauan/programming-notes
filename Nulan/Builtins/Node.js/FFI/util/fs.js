import { pend, unpend } from "./util";

const _fs = require("fs");


const callback = (cb) => (err, value) => {
  unpend();
  cb(err, value);
};


// TODO is it possible for this to deadlock ?
export const fs_open = (path, flags, cb) => {
  pend(() => {
    _fs["open"](path, flags, cb);
  });
};

export const fs_close = (fd, cb) => {
  _fs["close"](fd, callback(cb));
};

export const fs_stat = (path, cb) => {
  pend(() => {
    _fs["stat"](path, callback(cb));
  });
};

export const fs_chmod = (path, mode, cb) => {
  pend(() => {
    _fs["chmod"](path, mode, callback(cb));
  });
};

export const fs_lstat = (path, cb) => {
  pend(() => {
    _fs["lstat"](path, callback(cb));
  });
};

export const fs_rename = (from, to, cb) => {
  pend(() => {
    _fs["rename"](from, to, callback(cb));
  });
};

export const fs_rename_safe = (from, to, cb) => {
  pend(() => {
    // TODO figure out a better way to prevent overwriting `to`
    _fs["lstat"](to, (err, _) => {
      if (err) {
        if (err["code"] === "ENOENT") {
          // TODO there's a possible race condition in between calling `lstat` and calling `rename`
          _fs["rename"](from, to, callback(cb));

        } else {
          unpend();
          cb(err);
        }

      } else {
        unpend();
        // TODO what about the `code` property, etc. ?
        cb(new Error("EEXIST, rename '" + to + "'"));
      }
    });
  });
};

export const fs_unlink = (path, cb) => {
  pend(() => {
    _fs["unlink"](path, (err) => {
      unpend();

      // TODO code duplication
      if (err && err["code"] === "ENOENT") {
        cb(null);
      } else {
        cb(err);
      }
    });
  });
};

export const fs_rmdir = (path, cb) => {
  pend(() => {
    _fs["rmdir"](path, (err) => {
      unpend();

      // TODO code duplication
      if (err && err["code"] === "ENOENT") {
        cb(null);
      } else {
        cb(err);
      }
    });
  });
};

export const fs_readdir = (path, cb) => {
  pend(() => {
    _fs["readdir"](path, callback(cb));
  });
};

export const fs_utimes = (path, atime, mtime, cb) => {
  pend(() => {
    _fs["utimes"](path, atime, mtime, callback(cb));
  });
};

export const fs_chown = (path, uid, gid, cb) => {
  pend(() => {
    _fs["chown"](path, uid, gid, callback(cb));
  });
};

export const fs_mkdir = (path, mode, cb) => {
  pend(() => {
    _fs["mkdir"](path, mode, callback(cb));
  });
};

export const fs_symlink = (from, to, cb) => {
  pend(() => {
    // The arguments are flipped
    _fs["symlink"](to, from, callback(cb));
  });
};

export const fs_realpath = (path, cb) => {
  pend(() => {
    _fs["realpath"](path, callback(cb));
  });
};
