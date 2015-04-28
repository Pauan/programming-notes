export const array_copy = (array) => {
  const len = array["length"];
  const out = new Array(len);

  // TODO is it faster to use a var ?
  for (let i = 0; i < len; ++i) {
    out[i] = array[i];
  }

  return out;
};

export const list = (a) => {
  return a;
};

// TODO
// TODO test this
export const list_slice = (a, start, end) => {
  if (from < 0) {
    from = 0;
  }

  var len = array.length;
  if (to > len) {
    to = len;
  }

  if (from === 0 && to === len) {
    return array;
  } else {
    return array.slice(from, to);
  }
};

export const list_length = (a) => {
  return a["length"];
};

// TODO test this
export const list_concat = (a) => {
  // TODO use new Array ?
  const out = [];

  // TODO is it faster to use a var ?
  for (let i1 = 0; i1 < a["length"]; ++i1) {
    const x = a[i1];

    // TODO is it faster to use a var ?
    for (let i2 = 0; i2 < x["length"]; ++i2) {
      out["push"](x[i2]);
    }
  }

  return out;
};

// TODO test this
export const nth_get = (array, index, yes, no) => {
  if (index < 0) {
    index += array["length"];
  }

  if (index >= 0 && index < array["length"]) {
    return yes(array[index]);
  } else {
    return no();
  }
};

// TODO test this
export const nth_insert = (array, index, value) => {
  if (index < 0) {
    index += (array["length"] + 1);
  }

  if (index >= 0 && index <= array["length"]) {
    const len = array["length"] + 1;

    const out = new Array(len);

    // TODO is it faster to use a var ?
    let i = 0;
    while (i < index) {
      out[i] = array[i];
      ++i;
    }

    out[i] = value;
    ++i;

    while (i < len) {
      out[i] = array[i - 1];
      ++i;
    }

    return out;

  } else {
    throw new Error("Cannot nth-insert: index " + index + " is invalid");
  }
};

// TODO test this
export const nth_remove = (array, index) => {
  if (index < 0) {
    index += array["length"];
  }

  if (index >= 0 && index < array["length"]) {
    const len = array["length"] - 1;

    const out = new Array(len);

    // TODO is it faster to use a var ?
    let i = 0;
    while (i < index) {
      out[i] = array[i];
      ++i;
    }

    while (i < len) {
      out[i] = array[i + 1];
      ++i;
    }

    return out;

  } else {
    throw new Error("Cannot nth-remove: index " + index + " is invalid");
  }
};

// TODO test this
export const nth_modify = (array, index, f) => {
  if (index < 0) {
    index += array["length"];
  }

  if (index >= 0 && index < array["length"]) {
    const old_value = array[index];
    const new_value = f(old_value);

    // Optimization for equal values
    // TODO use the `equal?` function instead ?
    if (old_value === new_value) {
      return array;

    } else {
      const new_array = array_copy(array);
      new_array[index] = new_value;
      return new_array;
    }

  } else {
    throw new Error("Cannot nth-modify: index " + index + " is invalid");
  }
};

// TODO test this
export const push = (array, value) => {
  const len = array["length"] + 1;

  const out = new Array(len);

  // TODO is it faster to use a var ?
  for (let i = 0; i < len; ++i) {
    out[i] = array[i];
  }

  out[len] = value;

  return out;
};
