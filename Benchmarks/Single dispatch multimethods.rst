time("1", function () {
  "use strict";
  
  var foo = {
    bar: 1
  }
  
  function qux() {
    return foo.bar
  }
  
  return function () {
    qux()
  }
})

time("2", function () {
  "use strict";
  
  var foo = {
    bar: 1
  }

  function qux() {
    var key = "bar"
    return foo[key]
  }

  return function () {
    qux()
  }
})


time("Plain ol' functions", function () {
  "use strict";

  function Foo() {}

  function foo(x) {
    return 1
  }

  return function () {
    foo(new Foo())
  }
})


time("Plain ol' methods", function () {
  "use strict";

  function Foo() {}

  Foo.prototype.__foo__ = function () { return 1 }

  return function () {
    new Foo().__foo__()
  }
})


time("Single dispatch (compile-time)", function () {
  "use strict";

  var foo = function (x) {
      return x.__foo__.apply(null, arguments)
  }

  function Foo() {}

  function Bar() {}
  Bar.prototype = Object.create(Foo.prototype)

  function Qux() {}
  Qux.prototype = Object.create(Foo.prototype)
  
  function Corge() {}
  Corge.prototype = Object.create(Foo.prototype)
  
  function Nou() {}
  Nou.prototype = Object.create(Foo.prototype)

  Foo.prototype.__foo__ = function (x) { return 1 }
  Bar.prototype.__foo__ = function (x) { return 2 }
  Qux.prototype.__foo__ = function (x) { return 3 }
  Corge.prototype.__foo__ = function (x) { return 4 }
  Nou.prototype.__foo__ = function (x) { return 5 }

  return function () {
    foo(new Foo())
  }
})


time("Single dispatch (run-time)", function () {
  "use strict";

  function assert(b, s) {
      if (!b) { throw new Error(s) }
  }

  var __id__ = 0;

  // The "generic" and "extend" functions only need to be defined once.
  // They can then be used to create/extend multiple generic functions.
  var generic = function (name) {
      var key = "__unique_" + name + "_" + (++__id__) + "__";
      function f(x) {
          var method = x[key];
          assert(typeof method === "function", name + " called on invalid type");
          return method.apply(null, arguments);
      }
      f.__generic_key__ = key;
      return f;
  };

  var extend = function (gen, Type, f) {
      var key = gen.__generic_key__;
      assert(typeof key === "string", "extend can only be used on generic functions");
      assert(!Type.prototype.hasOwnProperty(key), "cannot extend with the same type twice");
      Type.prototype[key] = f;
  };

  var foo = generic("foo")

  function Foo() {}

  function Bar() {}
  Bar.prototype = Object.create(Foo.prototype)

  function Qux() {}
  Qux.prototype = Object.create(Foo.prototype)
  
  function Corge() {}
  Corge.prototype = Object.create(Foo.prototype)
  
  function Nou() {}
  Nou.prototype = Object.create(Foo.prototype)

  extend(foo, Foo, function (x) { return 1 })
  /*extend(foo, Bar, function (x) { return 2 })
  extend(foo, Qux, function (x) { return 3 })
  extend(foo, Corge, function (x) { return 4 })
  extend(foo, Nou, function (x) { return 5 })*/

  return function () {
    foo(new Foo())
  }
})


time("Single dispatch (eval)", function () {
  "use strict";

  function assert(b, s) {
      if (!b) { throw new Error(s) }
  }

  var __id__ = 0;

  // The "generic" and "extend" functions only need to be defined once.
  // They can then be used to create/extend multiple generic functions.
  var generic = function (name) {
      var key = "__unique_" + name + "_" + (++__id__) + "__";
      var f = new Function("x", 'return x.' + key + '.apply(null, arguments);')
      //var f = new Function("x", ['var method = x.' + key,
      //                           'if (typeof method !== "function") { throw new TypeError("' + name + ' called on invalid type") }',
      //                           'return method.apply(null, arguments);'].join(";\n"))
      f.__generic_key__ = key;
      return f;
  };

  var extend = function (gen, Type, f) {
      var key = gen.__generic_key__;
      assert(typeof key === "string", "extend can only be used on generic functions");
      assert(!Type.prototype.hasOwnProperty(key), "cannot extend with the same type twice");
      Type.prototype[key] = f;
  };

  var foo = generic("foo")

  function Foo() {}

  function Bar() {}
  Bar.prototype = Object.create(Foo.prototype)

  function Qux() {}
  Qux.prototype = Object.create(Foo.prototype)
  
  function Corge() {}
  Corge.prototype = Object.create(Foo.prototype)
  
  function Nou() {}
  Nou.prototype = Object.create(Foo.prototype)

  extend(foo, Foo, function (x) { return 1 })
  /*extend(foo, Bar, function (x) { return 2 })
  extend(foo, Qux, function (x) { return 3 })
  extend(foo, Corge, function (x) { return 4 })
  extend(foo, Nou, function (x) { return 5 })*/

  return function () {
    foo(new Foo())
  }
})


time("Predicate dispatch (compile-time + no checks)", function () {
  "use strict";

  function foo(x) {
      if (x instanceof Foo) {
          return 1
      }
  }

  function Foo() {}

  return function () {
    foo(new Foo())
  }
})


time("Predicate dispatch (compile-time)", function () {
  "use strict";
  
  function isa(x, type) {
      return x instanceof type
  }
  
  function foo() {
      if (arguments.length === 1) {
          var x = arguments[0]
          if (isa(x, Foo)) {
              return 1
          } else {
              throw new TypeError()
          }
      } else {
          throw new Error()
      }
  }
  
  function Foo() {}
  
  return function () {
    foo(new Foo())
  }
})


time("Predicate dispatch (run-time)", function () {
  "use strict";

  function __Method__(pattern, behavior) {
      this.pattern  = pattern
      this.behavior = behavior
  }

  function generic() {
      var methods = []
      function f() {
          top:
          for (var i = 0; i < methods.length; ++i) {
              var x = methods[i]
              var a = x.pattern
              if (arguments.length === a.length) {
                  for (var i2 = 0; i2 < a.length; ++i2) {
                      if (!a[i2].predicate(arguments[i2])) {
                          continue top
                      }
                  }
                  return x.behavior.apply(null, arguments)
              }
          }
          throw new Error("no matching patterns")
      }
      f.__methods__ = methods
      return f
  }

  function extend(generic, pattern, behavior) {
      var a = generic.__methods__
      var x = new __Method__(pattern, behavior)
      top:
      for (var i = 0; i < a.length; ++i) {
          var y = a[i]
          if (x.pattern.length === y.pattern.length) {
              for (var i2 = 0; i2 < x.pattern.length; ++i2) {
                  var pat1 = x.pattern[i2]
                    , pat2 = y.pattern[i2]
                  var result = pat1.sort(pat1, pat2)
                  if (result === "same") {
                      continue
                  } else if (result === "subset") {
                      a.splice(i, 0, x)
                      return
                  // supertype/disjoint
                  } else {
                      continue top
                  }
              }
              // all the patterns were the same
              throw new Error("duplicate patterns")
          }
      }
      a.push(x)
  }


  function Isa(x) {
      this.type = x
  }
  Isa.prototype.predicate = function (x) {
      return x instanceof this.type
  }
  Isa.prototype.sort = function (x, y) {
      if (x instanceof Isa && y instanceof Isa) {
          if (x.type.prototype === y.type.prototype) {
              return "same"
          } else if (x.type.prototype instanceof y.type) {
              return "subset"
          } else if (y.type.prototype instanceof x.type) {
              return "superset"
          } else {
              return "disjoint"
          }
      } else {
          return "disjoint"
      }
  }

  function isa(x) {
      return new Isa(x)
  }


  var foo = generic()

  function Foo() {}

  function Bar() {}
  Bar.prototype = Object.create(Foo.prototype)

  function Qux() {}
  Qux.prototype = Object.create(Foo.prototype)
  
  function Corge() {}
  Corge.prototype = Object.create(Foo.prototype)
  
  function Nou() {}
  Nou.prototype = Object.create(Foo.prototype)


  extend(foo, [isa(Foo)], function (x) { return 1 })
  /*extend(foo, [isa(Bar)], function (x) { return 2 })
  extend(foo, [isa(Qux)], function (x) { return 3 })
  extend(foo, [isa(Corge)], function (x) { return 4 })
  extend(foo, [isa(Nou)], function (x) { return 5 })*/

  return function () {
    foo(new Foo())
  }
})


time("Predicate dispatch (instanceof only)", function () {
  "use strict";

  function __Method__(pattern, behavior) {
      this.pattern  = pattern
      this.behavior = behavior
  }

  function generic() {
      var methods = []
      function f() {
          top:
          for (var i = 0; i < methods.length; ++i) {
              var x = methods[i]
              var a = x.pattern
              if (arguments.length === a.length) {
                  for (var i2 = 0; i2 < a.length; ++i2) {
                      if (!(arguments[i2] instanceof a[i2])) {
                          continue top
                      }
                  }
                  return x.behavior.apply(null, arguments)
              }
          }
          throw new Error("no matching patterns")
      }
      f.__methods__ = methods
      return f
  }

  function extend(generic, pattern, behavior) {
      var a = generic.__methods__
      var x = new __Method__(pattern, behavior)
      top:
      for (var i = 0; i < a.length; ++i) {
          var y = a[i]
          if (x.pattern.length === y.pattern.length) {
              for (var i2 = 0; i2 < x.pattern.length; ++i2) {
                  var pat1 = x.pattern[i2]
                    , pat2 = y.pattern[i2]
                  // same
                  if (pat1 === pat2) {
                      continue
                  // subtype
                  } else if (pat1.prototype instanceof pat2) {
                      a.splice(i, 0, x)
                      return
                  // supertype/disjoint
                  } else {
                      continue top
                  }
              }
              throw new Error("overlapping patterns")
          // disjoint
          } else {
              continue top
          }
      }
      a.push(x)
  }


  var foo = generic()

  function Foo() {}

  function Bar() {}
  Bar.prototype = Object.create(Foo.prototype)

  function Qux() {}
  Qux.prototype = Object.create(Foo.prototype)
  
  function Corge() {}
  Corge.prototype = Object.create(Foo.prototype)
  
  function Nou() {}
  Nou.prototype = Object.create(Foo.prototype)

  extend(foo, [Foo], function (x) { return 1 })
  /*extend(foo, [Bar], function (x) { return 2 })
  extend(foo, [Qux], function (x) { return 3 })
  extend(foo, [Corge], function (x) { return 4 })
  extend(foo, [Nou], function (x) { return 5 })*/

  return function () {
    foo(new Foo())
  }
})



time("Predicate dispatch (compile-time types)", function () {
  "use strict";

  function New(types, funcs, value) {
    if (value instanceof New) {
      value = value.value
    }
    this.types = types
    this.value = value
    for (var i = 0, iLen = funcs.length; i < iLen; ++i) {
      if (!funcs[i](value)) {
        throw new Error("value does not match type contract")
      }
    }
  }


  var foo_Foo

  function foo(a) {
    if (arguments.length === 1) {
      if (a instanceof New) {
        if (a.types._1) {
          return foo_Foo(a)
        }
      }
    }
    throw new Error("no matching patterns")
  }

  foo_Foo = function (x) {
    return 1
  }


  var Foo = function (x) {
    return true
  }

  return function () {
    foo(new New({ _1: true }, [Foo], 5))
  }
})



time("Predicate dispatch (compile-time single-inheritance types)", function () {
  "use strict";

  function Any(x) {
    this.value = x
  }
  Any.prototype = Object.create(null)

  function Foo(x) {
    this.value = x
  }
  Foo.prototype = Object.create(Any.prototype)

  function new_(type, x) {
    return new type(x)
  }


  var foo_Foo

  function foo(a) {
    if (arguments.length === 1) {
      if (a instanceof Foo) {
        return foo_Foo(a)
      }
    }
    throw new Error("no matching patterns")
  }

  foo_Foo = function (x) {
    return 1
  }


  return function () {
    foo(new_(Foo, 5))
  }
})



time("Predicate dispatch (types)", function () {
  "use strict";
  
  function __Method__(pattern, behavior) {
      this.pattern = pattern
      this.behavior = behavior
  }

  function generic() {
      var groups = []
      function f() {
          for (var i = 0; i < groups.length; ++i) {
              var methods = groups[i]
              var r = []
              top:
              for (var i2 = 0; i2 < methods.length; ++i2) {
                  var x = methods[i2]
                  var a = x.pattern
                  if (arguments.length === a.length) {
                      for (var i3 = 0; i3 < a.length; ++i3) {
                          if (!a[i3].predicate(arguments[i3])) {
                              continue top
                          }
                      }
                      r.push(x)
                  }
              }
              if (r.length === 1) {
                  return r[0].behavior.apply(null, arguments)
              } else if (r.length > 1) {
                  throw new Error("ambiguous patterns")
              }
          }
          throw new Error("no matching patterns")
      }
      f.__groups__ = groups
      return f
  }

  function extend(generic, pattern, behavior) {
      var a = generic.__groups__
      if (a.length === 0) {
          a.push([])
      }
      a[0].push(new __Method__(pattern, behavior))
  }


  function Isa(types, x) {
      this.types = types
      this.value = x
  }
  
  function Type(supers, predicate) {
      var self = this
      self.supers = []
      self.predicate = predicate
      ;(function anon(a) {
          a.forEach(function (x) {
              if (self.supers.indexOf(x) === -1) {
                  self.supers.push(x)
              }
              anon(x.supers)
          })
      })(supers)
  }


  var foo = generic()

  var Foo = new Type([], function (x) {
      return true
  })
  
  var Number = new Type([], function (x) {
      return typeof x === "number"
  })
  
  var Integer = new Type([], function (x) {
      return Math.round(x) === x
  })
  
  var Positive = new Type([], function (x) {
      return x > 0
  })

  //extend(foo, [Number], function (x) { return 1 })
  //extend(foo, [Integer], function (x) { return 2 })
  //extend(foo, [Positive], function (x) { return 3 })

  extend(foo, [Foo], function (x) { return 1 })
  /*extend(foo, [isa(Bar)], function (x) { return 2 })
  extend(foo, [isa(Qux)], function (x) { return 3 })
  extend(foo, [isa(Corge)], function (x) { return 4 })
  extend(foo, [isa(Nou)], function (x) { return 5 })*/

  return function () {
    foo(5)
  }
})