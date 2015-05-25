import { pend, unpend } from "./util";

const _fs = require("fs");


const callback = (cb) => (err, value) => {
  unpend();
  cb(err, value);
};


// TODO is it possible for this to deadlock ?
export const open = (path, flags, cb) => {
  pend(() => {
    _fs["open"](path, flags, cb);
  });
};

export const close = (fd, cb) => {
  _fs["close"](fd, callback(cb));
};

export const lstat = (path, cb) => {
  pend(() => {
    _fs["lstat"](path, callback(cb));
  });
};

export const rename = (from, to, cb) => {
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

export const unlink = (path, cb) => {
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

export const rmdir = (path, cb) => {
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

export const readdir = (path, cb) => {
  pend(() => {
    _fs["readdir"](path, callback(cb));
  });
};

export const utimes = (path, atime, mtime, cb) => {
  pend(() => {
    _fs["utimes"](path, atime, mtime, callback(cb));
  });
};

export const chown = (path, uid, gid, cb) => {
  pend(() => {
    _fs["chown"](path, uid, gid, callback(cb));
  });
};

export const mkdir = (path, mode, cb) => {
  pend(() => {
    _fs["mkdir"](path, mode, callback(cb));
  });
};

export const symlink = (from, to, cb) => {
  pend(() => {
    // The arguments are flipped
    _fs["symlink"](to, from, callback(cb));
  });
};

export const realpath = (path, cb) => {
  pend(() => {
    _fs["realpath"](path, callback(cb));
  });
};
