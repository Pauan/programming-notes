// This is significantly faster than using Array.prototype.reverse
// http://jsperf.com/array-reverse-function
const reverse = (array) => {
  let left  = 0;
  let right = array["length"] - 1;
  while (left <= right) {
    const tmp = array[left];
    array[left] = array[right];
    array[right] = tmp;

    ++left;
    --right;
  }
};

// This implementation has good performance, but not necessarily faster than a raw Array
// http://jsperf.com/promises-queue
export class Queue {
  constructor() {
    this._left  = [];
    this._right = [];
    this.length = 0;
  }

  peek() {
    return this._left[this._left["length"] - 1];
  }

  push(value) {
    if (this.length === 0) {
      this._left["push"](value);
    } else {
      this._right["push"](value);
    }

    ++this.length;
  }

  pull() {
    const left = this._left;

    var value = left["pop"]();

    --this.length;

    if (left["length"] === 0) {
      const right = this._right;

      if (right["length"] > 1) {
        reverse(right);
      }

      this._left = right;
      this._right = left;
    }

    return value;
  }
}


// TODO should this throw an error or something if `x` isn't in `array` ?
// TODO faster implementation of this
export const array_remove = (array, x) => {
  const i = array["indexOf"](x);
  if (i !== -1) {
    array["splice"](i, 1);
  }
};


// TODO use setImmediate shim
export const nextTick =
  // setImmediate is ~52.86 times faster than setTimeout
  (typeof setImmediate === "function"
    ? setImmediate                   // ~3,700
    : (f) => { setTimeout(f, 0) });  // ~70
