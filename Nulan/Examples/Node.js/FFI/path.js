// TODO all of these functions generally don't handle trailing slashes correctly

const _path = require("path");

export const path = (a) =>
  // This only works because Nulan Lists are implemented as JavaScript Arrays
  _path["join"](...a);

export const normalize_path = (s) =>
  _path["normalize"](s);

export const absolute_path = (a, s) =>
  // This only works because Nulan Lists are implemented as JavaScript Arrays
  _path["resolve"](...a, s);

export const is_absolute_path = (s) =>
  _path["isAbsolute"](s);

// TODO this has incorrect behavior for, e.g. "/foo/"
// TODO implement Maybe for this
export const directory_from_path = (s, nothing, something) =>
  _path["dirname"](s);

  // TODO this has incorrect behavior for, e.g. "/foo/"
  // TODO implement Maybe for this
export const file_from_path = (s, nothing, something) =>
  _path["basename"](s);

export const extension_from_path = (s, nothing, something) => {
  const ext = _path["extname"](s);
  if (ext === "") {
    return nothing();
  } else {
    return something(ext);
  }
};

export const is_hidden_file = (file) =>
  /(^|\/)\./["test"](file);
