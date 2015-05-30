import { waitfor } from "./util";
import { fs_stat, fs_rename, fs_chmod, fs_chown } from "./fs";


// TODO this isn't particularly robust, but it works most of the time
// TODO what if `to_path` is a symlink ?
export const fs_replace_file = (from_path, to_path, cb) => {
  // TODO should this use "stat" or "lstat" ?
  fs_stat(to_path, (err, stat) => {
    if (err) {
      cb(err);

    } else {
      const callback = waitfor(2, (err) => {
        if (err) {
          cb(err);
        } else {
          // TODO is this correct ?
          fs_rename(from_path, to_path, cb);
        }
      });

      // TODO what about `utimes` ?
      fs_chmod(from_path, stat["mode"], callback);
      // TODO if we change the owner, does that prevent us from using `chmod` or `rename` ?
      fs_chown(from_path, stat["uid"], stat["gid"], callback);
    }
  });
};
