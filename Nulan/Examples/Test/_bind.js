import { _bind, fastest } from "../FFI/Task";

const is_equal = (t, x1) =>
  _bind(t, (x2) => success(x2 === x2));

const test_bind_forever =
  fastest([forever(success(5)),
           _bind(delay(1000), (_) =>
             success(10))]);

export const test_bind = [
  is_equal(test_bind_forever, 10)
];
