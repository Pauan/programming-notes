::

    function Foo() {}

    Foo.prototype.__foo__ = function () { return 1 }

    // 24,941,979
    benchmark(function () {
      new Foo().__foo__()
    })

::

    function Foo() {}

    var foo = function (x) {
        return x.__foo__.apply(null, arguments);
    }
    Foo.prototype.__foo__ = function (x) { return 1 }

    // 13,375,001
    benchmark(function () {
      foo(new Foo())
    })

::

    function Foo() {}

    function assert(b, s) {
        if (!b) { throw new Error(s) }
    }

    // The "generic" and "extend" functions only need to be defined once.
    // They can then be used to create/extend multiple generic functions.
    var generic = (function () {
        var id = 0;
        return function (name) {
            var key = "__unique_" + name + "_" + (++id) + "__";
            function f(x) {
                var method = x[key];
                assert(typeof method === "function", name + " called on invalid type");
                return method.apply(null, arguments);
            }
            f.__generic_key__ = key;
            return f;
        };
    })();

    var extend = function (gen, Type, f) {
        var key = gen.__generic_key__;
        assert(typeof key === "string", "extend can only be used on generic functions");
        Type.prototype[key] = f;
    };

    var foo = generic("foo");
    extend(foo, Foo, function (x) { return 1 });

    // 6,878,742
    benchmark(function () {
      foo(new Foo())
    })