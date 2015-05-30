import { callback } from "./util";
import { fs_readdir } from "./fs";
import { push_Array } from "./stream";
import { push } from "../../../FFI/Stream"; // "nulan:Stream"
import { run } from "../../../FFI/Task"; // "nulan:Task"


const readdir_sorted = (path, cb) => {
  fs_readdir(path, (err, files) => {
    if (err) {
      cb(err);
    } else {
      cb(err, files.sort());
    }
  });
};

// TODO handle being killed
export const fs_files = (output, path) => (action) => {
  readdir_sorted(path, (err, files) => {
    if (err) {
      action.error(err);

    } else {
      push_Array(output, files)(action);
    }
  });
};

// TODO handle being killed
const push_files_recursive = (output, path, files, action, cb) => {
  const inner = (i) => {
    if (i < files["length"]) {
      const file = _path["join"](path, files[i]);

      readdir_sorted(file, (err, files) => {
        if (err) {
          if (err["code"] === "ENOTDIR") {
            const t = run(push(output, file), (_) => {
              inner(i + 1);
            }, cb);

            action.onKilled = () => {
              // TODO does it need to do anything else ?
              t.kill();
            };

          } else {
            cb(err);
          }

        } else {
          push_files_recursive(output, file, files, action, (err) => {
            if (err) {
              cb(err);
            } else {
              inner(i + 1);
            }
          });
        }
      });

    } else {
      cb(null);
    }
  };

  inner(0);
};

// TODO handle being killed ?
export const fs_files_recursive = (output, path) => (action) => {
  readdir_sorted(path, (err, files) => {
    if (err) {
      action.error(err);

    } else {
      push_files_recursive(output, path, files, action, callback(action));
    }
  });
};
