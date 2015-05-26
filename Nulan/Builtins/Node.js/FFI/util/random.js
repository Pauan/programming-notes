const _crypto = require("crypto");


const _random_chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const bytes_to_chars = (buf) => {
  const a = new Array(buf["length"]);

  for (let i = 0; i < buf["length"]; ++i) {
    a[i] = _random_chars[buf[i] % _random_chars["length"]];
  }

  return a["join"]("");
};

export const random_chars = (limit, f) => {
  _crypto["randomBytes"](limit, (err, buf) => {
    if (err) {
      // TODO test this
      console.log("RANDOM ERROR", err);

      _crypto["pseudoRandomBytes"](limit, (err, buf) => {
        if (err) {
          f(err, buf);
        } else {
          f(err, bytes_to_chars(buf));
        }
      });

    } else {
      f(err, bytes_to_chars(buf));
    }
  });
};
