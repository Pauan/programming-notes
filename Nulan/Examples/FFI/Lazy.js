export const lazy = (f) => ({
  forced: false,
  thunk: f
});

export const force = (x) => {
  if (!x.forced) {
    x.thunk = x.thunk();
    x.forced = true;
  }
  return x.thunk;
};
