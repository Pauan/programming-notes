export const array_copy = (array) => {
  const len = array["length"];
  const out = new Array(len);

  // TODO is it faster to use var ?
  for (let i = 0; i < len; ++i) {
    out[i] = array[i];
  }

  return out;
};

export const list = (a) => {
  return a;
};

// TODO test this
export const list_slice = (array, start, end) => {
  var len = array["length"];

  if (start < 0) {
    start += len;
  }

  if (end < 0) {
    end += len;
  }

  // No work needed, hurray
  if (start === 0 && end === len) {
    return array;

  } else if (start > end) {
    throw new Error("Cannot slice: start index " + start + " is greater than end index " + end);

  } else if (start >= 0 && start <= len) {
    if (start === end) {
      // TODO is it faster to use [] or new Array(0) ?
      return new Array(0);

    // Based upon the previous checks, `end` cannot be `0`
    } else if (end > 0 && end <= len) {
      var out = new Array(end - start);

      // TODO is it faster to use var ?
      for (let i = start; i < end; ++i) {
        out[i - start] = array[i];
      }

      return out;

    } else {
      throw new Error("Cannot slice: end index " + end + " is invalid");
    }

  } else {
    throw new Error("Cannot slice: start index " + start + " is invalid");
  }
};

export const list_length = (a) => {
  return a["length"];
};

// TODO test this
// TODO is it faster to first accumulate the lengths of the arrays, create
//      a perfectly-sized array, and then do the concat ?
export const list_concat = (a) => {
  // TODO use new Array ?
  const out = [];

  // TODO is it faster to use var ?
  for (let i1 = 0; i1 < a["length"]; ++i1) {
    const x = a[i1];

    // TODO is it faster to use var ?
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

    // TODO is it faster to use var ?
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

    // TODO is it faster to use var ?
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

  // TODO is it faster to use var ?
  for (let i = 0; i < len; ++i) {
    out[i] = array[i];
  }

  out[len] = value;

  return out;
};
