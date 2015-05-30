// TODO Node.js version, or maybe use a shim ?
const http_request = (type, url) => (action) => {
  var req = new XMLHttpRequest();

  let killed = false;

  // TODO what about the "timeout" event ?
  req["addEventListener"]("abort", () => {
    // TODO is this necessary ?
    if (!killed) {
      action.error(new Error(type + " request to URL '" + url + "' was aborted"));
    }
  }, true);

  req["addEventListener"]("error", () => {
    var s = type + " request to URL '" + url + "' failed";

    // TODO test this
    if (req["statusText"]) {
      s += (" (" + req["statusText"] + ")");
    } else if (req["status"]) {
      s += (" (" + req["status"] + ")");
    }

    action.error(new Error(s));
  }, true);

  req["addEventListener"]("load", () => {
    // TODO should ideally support types other than string (e.g. using req["response"])
    action.success(req["responseText"]);
  }, true);

  req["open"](type, url, true);
  req["send"]();

  action.onKilled = () => {
    killed = true;
    // TODO test this
    req["abort"]();
  };
};

export const http_get = (url) => http_request("GET", url);
