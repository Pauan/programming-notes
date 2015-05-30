export const delay = (ms) => (action) => {
  const timer = setTimeout(() => {
    action.success(undefined);
  }, ms);

  action.onKilled = () => {
    clearTimeout(timer);
  };
};

export const current_time = (action) => {
  action.success(Date["now"]());
};
