export const current_time = (action) => {
  action.success(Date["now"]());
};
