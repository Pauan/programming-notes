//////////////////////////////////////////////////////////////////////////////
// RAF
//////////////////////////////////////////////////////////////////////////////
const raf = (f) => {
};


//////////////////////////////////////////////////////////////////////////////
// Attributes
//////////////////////////////////////////////////////////////////////////////
const TAG     = "tag";
const STRETCH = "stretch";
const WIDTH   = "width";
const HEIGHT  = "height";

const print_attribute = (i) => i;

export const tag = (x) => {
  return {
    type: TAG,
    value: x
  };
};

export const stretch = () => {
  return {
    type: STRETCH,
    value: true
  };
};

export const width = (w) => {
  return {
    type: WIDTH,
    value: w
  };
};

export const height = (h) => {
  return {
    type: HEIGHT,
    value: h
  };
};


//////////////////////////////////////////////////////////////////////////////
// VHTML
//////////////////////////////////////////////////////////////////////////////
let vhtml_id = 0;

const TEXT = 0;
const ROW  = 1;
const COL  = 2;
const LAZY = 3;

const collapse_attributes = (a) => {
  const attrs = {};

  for (let i = 0; i < a["length"]; ++i) {
    const x = a[i];

    if (attrs[x.type] == null) {
      attrs[x.type] = x.value;

    } else {
      throw new Error("Duplicate attribute " + print_attribute(x.type));
    }
  }

  return attrs;
};

export const row = (attr, a) => {
  return {
    id: ++vhtml_id,
    type: ROW,
    attributes: collapse_attributes(attr),
    children: a
  };
};

export const col = (attr, a) => {
  return {
    id: ++vhtml_id,
    type: COL,
    attributes: collapse_attributes(attr),
    children: a
  };
};

export const lazy = (state, x) => {
  return {
    id: ++vhtml_id,
    type: LAZY,
    state: state,
    child: x
  };
};

export const text = (s) => {
  return {
    id: ++vhtml_id,
    type: TEXT,
    text: s
  };
};


//////////////////////////////////////////////////////////////////////////////
// DIFF
//////////////////////////////////////////////////////////////////////////////
const ADD_CHILD        = 0;
const REMOVE_CHILD     = 1;
const REPLACE_CHILD    = 2;

const REMOVE_ATTRIBUTE = 3;
const SET_ATTRIBUTE    = 4;

const diff_attributes = (a, old_vhtml, new_vhtml) => {
  // TODO more efficient algorithm
  for (let s in old_vhtml.attributes) {
    if (!(s in new_vhtml.attributes)) {
      a["push"]({
        type: REMOVE_ATTRIBUTE,
        key: s
      });
    }
  }

  // TODO more efficient algorithm
  for (let s in new_vhtml.attributes) {
    a["push"]({
      type: SET_ATTRIBUTE,
      key: s,
      value: new_vhtml.attributes[s]
    });
  }
};

const diff_children = (a, old_vhtml, new_vhtml) => {
  const old_length = old_vhtml.children["length"];
  const new_length = new_vhtml.children["length"];

  let i = 0;

  while (i < old_length) {
    if (i < new_length) {
      a["push"]({
        type: REMOVE_CHILD,
        id: old_vhtml.children[i].id
      });

    } else {
      const old_x = old_vhtml.children[i];
      const new_x = new_vhtml.children[i];

      if (old_x.id === new_x.id) {
      }
    }

    ++i;
  }
};

const diff_vhtml = (a, old_vhtml, new_vhtml) => {
  if (old_vhtml.type === new_vhtml.type) {
    if (!(old_vhtml.type === LAZY && old_vhtml.state === new_vhtml.state)) {
      diff_attributes(a, old_vhtml, new_vhtml);
      diff_children(a, old_vhtml, new_vhtml);
    }

  } else {
    a["push"]({
      type: REPLACE_CHILD,
      old: old_vhtml.id,
      new: new_vhtml
    });
  }
};

const apply_patches = (patches, html) => {
  for (let i = 0; i < patches["length"]; ++i) {
    const x = patches[i];
    switch (x.type) {
    case ADD_CHILD:
    case REMOVE_CHILD:
    case REPLACE_CHILD:
    case REMOVE_ATTRIBUTE:
    case SET_ATTRIBUTE:
    }
  }
};


//////////////////////////////////////////////////////////////////////////////
// HTML
//////////////////////////////////////////////////////////////////////////////
let html_id = 0;

const html_diffs = {};

const set_html_vhtml = (html, vhtml) => {
  if (html.__diff_id__ == null) {
    html.__diff_id__ = ++html_id;
  }

  html_diffs[html.__diff_id__] = vhtml;
};

export const body = (action) => {
  action.success(document["body"]);
};

const create_flexbox = (type) => {
  const html = document["createElement"]("div");

  handle_attributes(html, vhtml);
  handle_children(html, vhtml);

  return html;
};

const handle_attributes = (html, vhtml) => {
  for (let i = 0; i < vhtml.attributes["length"]; ++i) {
    const a = vhtml.attributes[i];

    switch (a.type) {
    case STRETCH:
      html["style"]["flex"] = "1";
      break;
    case WIDTH:
      html["style"]["width"] = a.value + "px";
      break;
    case HEIGHT:
      html["style"]["height"] = a.value + "px";
      break;
    }
  }
};

const handle_children = (html, vhtml) => {
  for (let i = 0; i < vhtml.children["length"]; ++i) {
    html["appendChild"](HTML_from_VHTML(vhtml.children[i]));
  }
};

const HTML_from_VHTML = (vhtml) => {
  switch (vhtml.type) {
  case TEXT:
    return document["createTextNode"](vhtml.text);

  case ROW:
    return create_flexbox("horizontal");

  case COL:
    return create_flexbox("vertical");
  }
};

export const render = (html, new_vhtml) => (action) => {
  set_html_vhtml(html, new_vhtml);
  html["innerHTML"] = "";
  html["appendChild"](HTML_from_VHTML(new_vhtml));
};

export const render_diff = (html, old_vhtml, new_vhtml) => (action) => {
  set_html_vhtml(html, new_vhtml);

  raf(() => {
    patch(html, old_vhtml, new_vhtml);
  });
};
