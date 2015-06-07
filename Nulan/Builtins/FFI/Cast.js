import { isInteger, isFloat } from "./Util";


export const String_to_Integer = (from, some, none) => {
  const to = +from;
  if (isInteger(to)) {
    return some(to);
  } else {
    return none;
  }
};

export const Integer_to_String = (from) => "" + from;


export const String_to_Float = (from, some, none) => {
  const to = +from;
  if (isFloat(to)) {
    return some(to);
  } else {
    return none;
  }
};

export const Float_to_String = (from) => "" + from;


export const Float_to_Integer = (from, some, none) => {
  if (isInteger(from)) {
    return some(from);
  } else {
    return none;
  }
};

export const Integer_to_Float = (from) => from;
