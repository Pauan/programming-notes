Plain ol' synchronous::

  function qux(a) {
    return a + 3
  }

  function bar(a) {
    return qux(a + 2)
  }

  function foo(a) {
    return bar(a) + bar(a)
  }

  // 778,355
  benchmark(function (done) {
    foo(50)
    nextTick(done)
  })

Callbacks (CPS transformation)::

  // This is so that the functions can work in tail call position
  ;(function () {
    "use strict";

    function qux(cont, a) {
      return cont(a + 3)
    }

    function bar(cont, a) {
      return qux(cont, a + 2)
    }

    function foo(cont, a) {
      var cont2 = function (data1, err) {
        if (err) {
          return cont(null, err)
        } else {
          var cont3 = function (data2, err) {
            if (err) {
              return cont(null, err)
            } else {
              return cont(data1 + data2)
            }
          }
          cont3.__func__ = bar
          cont3.__parent__ = cont2
          return bar(cont3, a)
        }
      }
      cont2.__func__ = bar
      cont2.__parent__ = cont
      return bar(cont2, a)
    }

    /*var main = function (data, err) {
      if (err) throw err
      console.log(data)
    }
    main.__func__ = foo
    foo(main, 50)*/

    // 736,736
    benchmark(function (done) {
      foo(function () {
        nextTick(done)
      }, 50)
    })
  })()

Continuations::

  function Cont(f) {
    this.func = f
    this.args = [].slice.call(arguments, 1)
  }
  
  function run(x, f) {
    
  }

  function qux(a) {
    return a + 3
  }

  function bar(a) {
    return qux(a + 2)
  }

  function foo(a) {
    return new Cont(function (x, y) { return x + y }, new Cont(bar, a), new Cont(bar, a))
  }

  benchmark(function (done) {
    run(foo(50), done)
  })

Promises::

  function qux(a) {
    return Promise.resolve(a + 3)
  }

  function bar(a) {
    return qux(a + 2)
  }

  function foo(a) {
    return bar(a).then(function (u1) {
      return bar(a).then(function (u2) {
        return u1 + u2
      })
    })
  }

  // 590,194
  benchmark(function (done) {
    foo(50).then(done)
  })

Generators::
  
  function isGenerator(x) {
    return {}.toString.call(x) === "[object Generator]"
  }

  function run1(gen, v, done) {
    if (v.done) {
      done(null, v.value)
    } else {
      run(v.value, function (err, value) {
        if (err) {
          done(err)
          //gen.throw(err)
        } else {
          run1(gen, gen.next(value), done)
        }
      })
    }
  }
  
  function tryCatch(gen, done) {
    try {
      run1(gen, gen.next(), done)
    } catch (e) {
      done(e)
    }
  }

  function run(gen, done) {
    if (isGenerator(gen)) {
      tryCatch(gen, done)
    } else {
      gen(done)
    }
  }

/*  function sleep(f, i) {
    return function (done) {
      setTimeout(function () {
        run(f(), done)
      }, i)
    }
  }*/

  function* qux(a) {
    return a + 3
  }

  function* bar(a) {
    return (yield qux(a + 2))
  }

  function* foo(a) {
    //return (yield sleep(function* () {
      return (yield bar(a)) + (yield bar(a))
    //}, 1000))
  }

  // 478,121
  benchmark(function (done) {
    run(foo(50), function () {
      nextTick(done)
    })
  })




var a = []
var i = 10000
while (i--) {
  a.push(i)
}


function foldl1(i, x, init, f, cb) {
  if (i < x.length) {
    f(init, x[i], function (err, y) {
      if (err) {
        cb(err)
      } else {
        foldl1(i + 1, x, y, f, cb)
      }
    })
  } else {
    cb(null, init)
  }
}

function foldl(x, init, f, cb) {
  foldl1(0, x, init, f, cb)
}

foldl(a, 0, function (x, y, cb) { cb(null, x + y) }, function (err, x) {
  console.log(x)
})


function* foldl(x, init, f) {
  for (var i = 0; i < x.length; ++i) {
    init = yield f(init, x[i])
  }
  return init
}

run(foldl(a, 0, function* (x, y) { return x + y }), function (err, x) {
  console.log(x)
})


function foldl(x, init, f) {
  for (var i = 0; i < x.length; ++i) {
    init = f(init, x[i])
  }
  return init
}

foldl(a, 0, function (x, y) { return x + y })