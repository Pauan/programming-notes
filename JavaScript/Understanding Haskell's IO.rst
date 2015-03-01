This guide is intended for JavaScript programmers who are interested in learning a little
bit about how Haskell works.

In particular, you might have heard that Haskell is "purely functional", but what does
"purely functional" mean?

First, I must define what it means for a function to be "pure" or "impure":

* A pure function is very simple: it takes in input, and returns output. If given the same
  input, it will **always** give the same output.

  In addition, it cannot mutate anything. It cannot mutate a global variable. It cannot
  mutate a property in an object. It cannot do any kind of I/O [1]_ (like reading a file).

  Here is an example of a pure function:

  .. code:: javascript

    function add(x, y) {
      return x + y;
    }

  If you give the same inputs to ``add``, you will get back the same result. And it's obvious
  that it does not mutate anything, and it does not do any I/O.

* An impure function is *any* function that is not pure. Most functions in JavaScript are impure.

When I say that a language is "purely functional" (like Haskell), that means that *every single
function in the entire language* is pure. No exceptions.

Hold on a minute, if Haskell is a purely functional language, then *by definition* it
cannot do any kind of I/O! But Haskell *can* do I/O, so why do I claim that
it is purely functional?!

To explain this apparent contradiction, let's first *assume* that it is possible to do
I/O in a purely functional way. How would you do it? Well, a pure function must
return the same result when given the same inputs. So let's start by replacing all I/O
functions with pure functions.

To do this, we'll create an ``IO`` type, which doesn't actually do anything, it just
*describes* an I/O action:

.. code:: javascript

  function IO(type, args) {
    this.type = type;
    this.args = args;
  }

Ordinarily, the ``console.log`` function prints something to the console and returns
``undefined``, but let's instead write a pure version that doesn't do anything, but
returns an ``IO``:

.. code:: javascript

  function log(str) {
    return new IO("log", [str]);
  }

You'll notice that when given the same inputs, we get back an ``IO`` with the same
``type`` and ``args`` [2]_. So this is a pure function.

Let's write some pure functions that read / write files:

.. code:: javascript

  function readFile(path) {
    return new IO("readFile", [path]);
  }

  function writeFile(path, value) {
    return new IO("writeFile", [path, value]);
  }

Hurray, we solved the contradiction, let's celebrate with a party! Oh, but there's just
one tiny little problem... our ``log`` function doesn't actually print anything to the
console. And our ``readFile`` and ``writeFile`` don't actually read / write files.
Oops, I guess we should fix that.

But we want to keep ``log``, ``readFile``, and ``writeFile`` pure. So instead, let's
write an **impure** function called ``run``:

.. code:: javascript

  var fs = require("fs");

  function run(io) {
    if (io.type === "log") {
      console.log(io.args[0]);

    } else if (io.type === "readFile") {
      fs.readFile(io.args[0], { encoding: "utf8" });

    } else if (io.type === "writeFile") {
      fs.writeFile(io.args[0], io.args[1], { encoding: "utf8" });
    }
  }

Now we can do stuff!

.. code:: javascript

  run(log("foo"));

  run(readFile("bar"));

  run(writeFile("qux", "corge"));

This seems kind of silly: we have to use this annoying ``run`` function all
the time. Even worse, ``readFile`` is useless, because ``run`` always returns
``undefined``. And any errors when reading / writing a file are ignored!

Let's fix this by writing a pure function called ``chain`` [3]_:

.. code:: javascript

  function chain(io, f) {
    return new IO("chain", [io, f]);
  }

The ``chain`` function returns an ``IO`` that first runs ``io``, and then
calls ``f`` with the result of running ``io``. In addition, ``f`` must
return an ``IO``.

Now let's fix up the implementation of ``run``:

.. code:: javascript

  function run(io, cb) {
    if (io.type === "log") {
      console.log(io.args[0]);
      cb(null);

    } else if (io.type === "readFile") {
      fs.readFile(io.args[0], { encoding: "utf8" }, cb);

    } else if (io.type === "writeFile") {
      fs.writeFile(io.args[0], io.args[1], { encoding: "utf8" }, cb);

    } else if (io.type === "chain") {
      var f = io.args[1];

      run(io.args[0], function (err, data) {
        if (err) {
          cb(err);
        } else {
          run(f(data), cb);
        }
      });
    }
  }

The above code might seem confusing, but it's actually really simple.
The ``run`` function now accepts a callback, so that ``readFile`` can
return a result, and so that errors are not ignored. It also has an
implementation for ``chain``.

You can use ``chain`` to *chain* ``IO`` actions together. Here's an
example:

.. code:: javascript

  function copy(from, to) {
    return chain(readFile(from), function (data) {
      return writeFile(to, data);
    });
  }

The ``copy`` function returns an ``IO`` which will first read from
the file, and will then write the data to another file.

If you think the above code looks a lot like Promises, you're
right! There are a lot of similarities between Promises and ``IO``.

But there are some differences too:

* A ``copy`` function using Promises actually does I/O, and so it's impure.

* Our ``copy`` function doesn't do any I/O, it just returns an ``IO``,
  and so it's pure. It's only the ``run`` function that's impure.

Let's try adding in a bit of logging:

.. code:: javascript

  function copy(from, to) {
    return chain(readFile(from), function (data) {
      return chain(log("Read from file " + from), function () {
        return chain(writeFile(to, data), function () {
          return log("Wrote to file " + to);
        });
      });
    });
  }

Our new version of ``copy`` will copy the file just like before, but it will
also print to the console after it reads / writes to the file.

The above code is really difficult to read. So let's add in a bit of syntax:

.. code:: javascript

  function copy(from, to) {
    return do {
      var data = readFile(from);
      log("Read from file " + from);
      writeFile(to, data);
      log("Wrote to file " + to);
    }
  }

The ``do`` syntax is expanded to exactly the same code as before, but it's
much more readable!

In fact, it looks the same as an imperative program. But what's actually
happening is very different: it returns an ``IO`` that describes what to
do, but it doesn't actually do it. So our ``copy`` function is pure. It's
only when we call ``run`` that it actually does the impure I/O.

In addition, even though the ``do`` block *looks* synchronous, it's actually
using the asynchronous ``fs.readFile`` and ``fs.writeFile``!

Let's add another restriction. Our program must have a ``main`` function,
which must return an ``IO``:

.. code:: javascript

  function main() {
    return copy("foo", "bar");
  }

In addition, we are no longer allowed to call the ``run`` function.
Instead, the ``run`` function is *automatically* called, like this:

.. code:: javascript

  run(main(), function (err) {
    if (err) {
      throw err;
    }
  });

Now, let's take a step back and look at this system. All of our
functions are pure: ``main``, ``log``, ``readFile``, ``writeFile``,
and ``copy`` all return ``IO`` objects, they don't actually do any
I/O.

And we're no longer allowed to call the ``run`` function, instead
it is called automatically for us. So as far as our program is
concerned, everything is pure! The only impure part of our program
is the ``run`` function, which is hidden from us.

And that's how Haskell is able to do I/O while still being purely
functional.

But, why do all of this? Why not just use impure I/O functions, or
Promises, or whatever?

If *everything* in the language is pure, it makes it easier for
humans to understand the behavior of the program. In addition, it's
much easier for the *compiler* to understand the behavior of the
program.

* Because of this, the compiler can do all kinds of optimizations:

  * It can re-arrange the order that things are evaluated.

    Hold on, if the ``IO`` functions are pure, what if the compiler
    decides to re-arrange the order? Wouldn't that break the program?

    No, it does not, and the reason is because of the way that
    ``chain`` works. If you look at the implementation in ``run``,
    you'll see that it *first* runs the ``IO``, and only *afterwards*
    it calls the function. That guarantees that ``IO`` are always
    run in the correct order.

  * It can avoid evaluating things until they're needed.

    Does that mean that an ``IO`` might never be run? That depends:

    * If the ``IO`` is connected either directly or indirectly to
      ``main``, then it will be run (in the correct order, with error
      checking).

    * But if it's not connected to ``main``, then it won't be run at
      all.

  * If the same function is called twice with the same arguments,
    the compiler can avoid calling it a second time, because it
    knows the result is going to be the same.

  * It can remove code that is never used. As an example:

    .. code:: javascript

      copy("foo", "bar");

    Because ``copy`` is a pure function, and its results are not used
    anywhere, the compiler can safely remove it without changing the
    behavior of the program.

  * Because pure functions can be evaluated in any order, they're really
    easy to evaluate in parallel. The compiler can even do this
    automatically, without changing the behavior of your program.

    This is one of the reasons why Haskell programs are so fast with
    multiple CPU cores.

* It's much easier to write unit tests for pure functions.

* Because all impure things are encapsulated in the ``IO`` type, it's
  not possible to accidentally mix pure and "impure" functions. Either a
  function returns an ``IO`` and so it's "impure", or it doesn't, and so
  it's pure. This makes it harder to make mistakes, and also makes the
  code self-documenting (and thus easier to understand).

* Mistakes are found sooner. Consider this program written with Promises:

  .. code:: javascript

    function copy(from, to) {
      readFile(from).then(function (data) {
        return writeFile(to, data);
      });
    }

  The program appears to be correct, and it even successfully copies
  the file, but it has a very bad bug: if an error occurs, it is
  completely ignored, because we forgot to return the Promise! Here
  is the correct version:

  .. code:: javascript

    function copy(from, to) {
      return readFile(from).then(function (data) {
        return writeFile(to, data);
      });
    }

  Here's another example, also using Promises:

  .. code:: javascript

    var foo = readFile("bar");

  If an error occurs, but ``foo`` is never used, then the error is silently
  ignored.

  With ``IO``, either the I/O occurs (with correct error checking), or
  the I/O does not occur. So we would notice the mistake much sooner.

.. [1] I/O is short for input / output, and it includes things like reading / writing a file,
       sending / receiving stuff over the internet, printing to the console, etc.

.. [2] A clever reader might point out that because JavaScript has object equality, even if the
       ``type`` and ``args`` are the same, the ``IO`` object itself is different.

       That is correct, but it's also irrelevant to this guide. Haskell has value equality,
       so just pretend that JavaScript has value equality (rather than object equality).

.. [3] In Haskell, the ``chain`` function is called ``>>=``. In addition, it works on all
       Monads, not just ``IO``.