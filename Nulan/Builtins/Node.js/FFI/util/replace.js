import { waitfor } from "./util";
import { stat, rename, chmod, chown } from "./fs";


// TODO this isn't particularly robust, but it works most of the time
// TODO what if `to_path` is a symlink ?
export const replace_file = (from_path, to_path, cb) => {
  // TODO should this use "stat" or "lstat" ?
  stat(to_path, (err, stat) => {
    if (err) {
      cb(err);

    } else {
      const callback = waitfor(2, (err) => {
        if (err) {
          cb(err);
        } else {
          // TODO is this correct ?
          rename(from_path, to_path, cb);
        }
      });

      // TODO what about `utimes` ?
      chmod(from_path, stat["mode"], callback);
      // TODO if we change the owner, does that prevent us from using `chmod` or `rename` ?
      chown(from_path, stat["uid"], stat["gid"], callback);
    }
  });
};
