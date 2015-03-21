This guide is intended for JavaScript programmers who are interested in learning a little
bit about how Haskell works.

In particular, you might have heard that Haskell is "purely functional", but what does
"purely functional" mean?

First, I must define what it means for a function to be "pure" or "impure":

* A pure function is very simple: it takes in input, and returns output. If given the same
  input, it will **always** return the same output.

  In addition, it cannot mutate anything. It cannot mutate global variables. It cannot mutate
  local variables. It cannot mutate properties in an object. It cannot throw an exception. It
  cannot do any kind of I/O [1]_ (like reading a file).

  Here is an example of a pure function:

  .. code:: javascript

    function add(x, y) {
      return x + y;
    }

  If you give the same inputs to ``add``, you will get back the same result. And it's obvious
  that it does not mutate anything, it does not throw any exceptions, and it does not do any I/O.

* An impure function is *any* function that is not pure. Almost all functions in JavaScript are
  impure.

When I say that a language is "purely functional" (like Haskell), that means that *every single
function in the entire language* is pure. No exceptions.

Why would you want that? Isn't purity just some abstract academic thing that has no practical
benefit? On the contrary, there are multiple *significant* benefits to pure functions:

* Dead code removal. What that means is, if some code isn't used, the compiler can just
  remove it entirely. Consider this JavaScript program:

  .. code:: javascript

    function add(x, y) {
      return x + y;
    }

    add(5, 10);

  Because we know that ``add`` is pure, and the expression ``add(5, 10)`` isn't used anywhere,
  we can safely remove it. And now the ``add`` function itself isn't used anywhere, so we can
  remove it too!

  If all functions are pure, then it's *really* easy for the compiler to do this.

  But why should you care about this? Imagine that there's some useful library that contains
  a lot of useful functions, but you only want to use a small handful of them. In JavaScript,
  you only have two options:

  * Import the big library and just use it.

  * Create a fork of the library, remove all the things you don't use, and then import the fork.

  Neither option is very good: importing the big library bloats up the size of your JavaScript
  files, which means longer downloads for people visiting your website. And creating / maintaining
  a fork is time-consuming and tedious.

  But if the compiler can automatically remove dead code, then you have a third option:

  * Import the big library and just use it. The compiler will automatically remove anything you
    don't use.

  Okay, so let's just write a dead code remover for JavaScript! There's two major JavaScript
  compilers that can remove dead code:

  * The `UglifyJS <https://github.com/mishoo/UglifyJS2>`_ minifier removes dead code, but only if
    it can prove that the code is pure. Because JavaScript code can have arbitrary side effects,
    it's *extremely* hard to prove that a particular function is pure.

    Even something as innocent as ``foo.bar`` could have side effects if ``foo`` is a ``Proxy``,
    or if it has a getter for the ``bar`` property.

    So the end result is that it removes very little dead code, and so it's not very useful for
    big libraries.

  * The `Google Closure Compiler <https://github.com/google/closure-compiler>`_ with
    ``ADVANCED_OPTIMIZATIONS`` removes a lot of dead code, because it removes dead code even if it
    *can't* prove that it's pure. But that means that it can break perfectly valid JavaScript
    programs.

  So, because JavaScript is so impure, your two choices are to either remove very little dead code,
  or to remove lots of dead code but break programs. Both options are bad.

  But if *all* your code is pure, then the compiler can aggressively remove **all** the dead code,
  and it's *guaranteed* to not break your program. The end result is that you can use lots of big
  libraries, but it'll compile down to very small code, which means faster downloads!

* Running code on multiple threads / cores is becoming more and more important, yet most programming
  languages have an incredibly hard time dealing with parallel code.

  The reason is: the behavior of an impure function depends on *when* it is executed, and parallel
  code can execute in any order, which messes up the behavior of impure functions. The primary
  way to deal with this is to use locks, which are slow and easy to get wrong.

  On the other hand, pure code *does not care* what order it is evaluated in, and so it's incredibly
  easy to run pure code on multiple threads / cores. It does not require any locks, and race conditions
  are impossible.

  Consider this JavaScript program:

  .. code:: javascript

    foo(expensive_computation1(), expensive_computation2());

  Because JavaScript is impure, the order of execution matters, and so JavaScript will always run
  ``expensive_computation1()`` first, and afterwards it will run ``expensive_computation2()``.

  But if they are pure, then they could be run in any order, and they could even be run in parallel.
  A smart compiler could notice this and *automatically* run your code in parallel for you. It can
  do this without breaking your program *because the functions are pure*.

  For similar reasons, pure functions work very well with distributed programs (where a program is
  run on multiple separate computers). An example is a server cluster which has many machines
  serving the same webpage.

* Unit testing becomes incredibly easy! With impure functions, writing unit tests is complicated:
  you need mock objects, you need to test the state of the program, reset the state after every
  test, etc.

  With pure functions, you simply give it some arguments and check that the output is correct.
  That's it! There's no need to test state. No need for mock objects. All of that complexity just
  melts away.

  It also allows for cool stuff like Haskell's `QuickCheck <https://en.wikipedia.org/wiki/QuickCheck>`_,
  where you give it a simple specification, and it then *automatically* writes your unit tests.

* Programs become much easier to understand, because pure functions don't have any mutable state.
  That means you can often look at a single function and understand it, without needing to worry about
  what other functions are doing.

There are other benefits to pure code, like increased compiler optimizations, laziness, etc. but
in my opinion they're not as important.

So, pure functions are clearly awesome. But we **need** impurity, because we need to able to do
useful stuff like log to the console, throw exceptions, read / write to a file, open a network socket,
etc.

Because of that, some languages like `ML <http://en.wikipedia.org/wiki/ML_(programming_language)>`_
or `Clojure <http://en.wikipedia.org/wiki/Clojure>`_ are *mostly* pure. That means they strongly
encourage writing pure functions, but they have a handful of impure functions for doing useful
things.

The problem is, if your language has even a *single* impure function, the compiler now has to do
extensive analysis to prove that your code is pure, before it can apply the above benefits.

However, it is possible to do impure things (like reading / writing a file), while still getting
all of the benefits of pure code! And that's exactly what Haskell does. That sounds like some kind of
crazy magic trick: how can Haskell remain purely functional, without *any* impure functions, yet still
do impure things? What's the secret?

First, we have to shift our mental perspective. A language like JavaScript *executes* things.

Consider this impure JavaScript program:

.. code:: javascript

  var x = foo();
  var y = bar();
  qux(x, y);

JavaScript programs have a very well-defined *order of execution*: we know for certain that
``foo()`` will be *executed* first, and then ``bar()`` will be *executed*, and then ``qux(x, y)``
will be *executed*.

Execution can have arbitrary side effects: ``foo`` might throw an exception, log to the console,
read / write a file, etc. That's why the order of execution is so important.

In a purely functional language, you don't have execution. Instead, you have *evaluation*.
Evaluation basically means replacing a more complex thing with a less complex thing, until you
can't replace it anymore.

Consider this pure JavaScript program:

.. code:: javascript

  5 + 10 * 15;

When this program is *evaluated*, it will replace the complex expression ``10 * 15`` with the
simpler expression ``150``, and will then replace the complex expression ``5 + 150`` with the
simpler expression ``155``. It cannot make the expression ``155`` any simpler, and so it stops.

The same is true for functions:

.. code :: javascript

  function add(x, y) {
    return x + y;
  }

  function mul(x, y) {
    return x * y;
  }

  add(5, mul(10, 15));

When this program is *evaluated*, it will replace ``mul(10, 15)`` with ``10 * 15``, replace that
with ``150``, and then replace ``add(5, 150)`` with ``5 + 150``, and replace that with ``155``.

This concept of "replacing things" works because every function is pure, so we can simply take
the body of the function and replace the arguments with values.

So we have this big difference, between *evaluation* and *execution*. In JavaScript, the two
concepts are intermingled together. But pure functions have no concept of execution at all,
they only have the concept of evaluation.

So let's write some functions which don't *do* anything, but instead *describe an action*:

.. code :: javascript

  function Task(action, args) {
    this.action = action;
    this.args = args;
  }

  function log(x) {
    return new Task("log", [x]);
  }

  function error(x) {
    return new Task("error", [x]);
  }

We have created a new type called ``Task`` [2]_, and two functions called ``log`` and
``error``.

It's important to understand that the ``log`` and ``error`` functions don't *do* anything:
they just return a Task. And so, the ``log`` and ``error`` functions are *pure* [3]_.

That means we get **all** of the benefits of pure functions. If the compiler sees this:

.. code:: javascript

  log("foo");

Then it can safely remove it, because the ``log`` function is pure.

Well, that's great and all, but we *do* actually want to log to the console. So let's
write an **impure** function which executes a Task:

.. code:: javascript

  function execute(task) {
    if (task.action === "log") {
      console.log(task.args[0]);

    } else if (task.action === "error") {
      throw new Error(task.args[0]);

    } else {
      throw new Error("Invalid action: " + task.action);
    }
  }

The ``execute`` function takes a Task and executes it. Tasks are pure, because they don't
do anything, they just *describe* an action. But the ``execute`` function is **impure**: it
actually has side effects.

So now we can do impure stuff:

.. code:: javascript

  execute(log("foo"));

  execute(error("bar"));

----

However, it's annoying that we have to add a new ``} else if (task.action === "...") {`` to
``execute`` every time we want to add a new Task. So let's change the implementation:

.. code:: javascript

  function Task(fn) {
    this.fn = fn;
  }

  function log(x) {
    return new Task(function () {
      return Promise.resolve(console.log(x));
    });
  }

  function error(x) {
    return new Task(function () {
      return Promise.reject(new Error(x));
    });
  }

Rather than being a string and an array of arguments, a Task is now a function that when
called will return a `JavaScript Promise <https://www.promisejs.org/>`_.

Let's change our ``execute`` function so that it can handle Promises:

.. code:: javascript

  function Task_to_Promise(task) {
    return task.fn();
  }

  function execute(task) {
    Task_to_Promise(task).catch(function (e) {
      console.error(e.stack);
    });
  }

Now let's add in some functions that can read / write from a file:

.. code:: javascript

  var fs = require("fs");

  function readFile(path) {
    return new Task(function () {
      return new Promise(function (resolve, reject) {
        fs.readFile(path, { encoding: "utf8" }, function (err, data) {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    });
  }

The ``readFile`` function looks complicated, so let's go through it step by step.
First, it returns a Task. Because Tasks don't do anything, this function is pure.
When that Task is executed, it will return a Promise. That Promise will then call
Node.js's ``fs.readFile`` function, and will either resolve or reject the Promise,
depending on if there is an error or not.

The ``writeFile`` function is the same, except it uses ``fs.writeFile`` to write
to a file:

.. code:: javascript

  function writeFile(path, x) {
    return new Task(function () {
      return new Promise(function (resolve, reject) {
        fs.writeFile(path, x, { encoding: "utf8" }, function (err, data) {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    });
  }

Let's also add in a function that delays execution by a certain number of
milliseconds:

.. code:: javascript

  function delay(ms) {
    return new Task(function () {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve();
        }, ms);
      });
    });
  }

The ``delay`` function takes in an integer and returns a Task. When executed, the
Task will return a Promise. That Promise will use ``setTimeout`` to wait for ``ms``
milliseconds, and will then resolve the Promise.

But we have a problem: we can read a file, but we have no way to access the
contents of the file. ``readFile("foo")`` returns a Task, not the file contents.
And ``execute(readFile("foo"))`` returns ``undefined``.

In addition, the ``delay`` function doesn't work the way we want it to:

.. code:: javascript

  execute(delay(1000));

  execute(log("foo"));

We expected it to wait for 1 second and then log to the console, but instead it logs to
the console immediately!

The problem is that there is no connection between the ``delay`` and the ``log``: it's
like as if they were executing in two separate threads. So, let's add in another function:

.. code:: javascript

  function bind(task, f) {
    return new Task(function () {
      return Task_to_Promise(task).then(function (x) {
        return Task_to_Promise(f(x));
      });
    });
  }

The ``bind`` [4]_ function takes in a Task ``task`` and a function ``f``. The function ``f`` is
supposed to return a Task.

When ``bind`` is executed, it will execute ``task``, and will then call the function ``f`` with
the result of ``task``, and will then execute the Task that ``f`` returns.

We can use this function to *bind* the result of a Task to a variable:

.. code:: javascript

  execute(bind(readFile("foo"), function (file) {
    // `file` is a string that contains the contents of the file "foo"
  }));

We can also use ``bind`` to execute one Task after another:

.. code:: javascript

  execute(bind(delay(1000), function () {
    return log("foo");
  }));

Now it correctly waits 1 second, and then logs to the console.

By using this, we can write a function that copies a file:

.. code:: javascript

  function copyFile(from, to) {
    return bind(readFile(from), function (file) {
      return writeFile(to, file);
    });
  }

The ``copyFile`` function returns a Task. When that Task is executed, it will
first read from the file, and will then write the file's contents to another file.

Let's add in some logging, so we can see exactly when it reads / writes the file:

.. code:: javascript

  function copyFile(from, to) {
    return bind(log("Reading file " + from), function () {
      return bind(readFile(from), function (file) {
        return bind(log("Writing file " + to), function () {
          return writeFile(to, file);
        });
      });
    });
  }

Gosh that's awfully verbose. So let's add in some syntax sugar:

.. code:: javascript

  function copyFile(from, to) {
    return do {
      log("Reading file " + from);
      file <- readFile(from);
      log("Writing file " + to);
      writeFile(to, file);
    }
  }

The compiler will replace the ``do { ... }`` syntax with ``bind``, so it's exactly the
same, but it's a lot more readable!

In fact, it looks very similar to an impure JavaScript program. But what's actually
happening is very different: it returns a ``Task`` that describes what to
do, but it doesn't actually do it. So our ``copyFile`` function is pure. It's
only when we call ``execute`` that it actually does the impure I/O.

In addition, even though the ``do`` block *looks* synchronous, it's actually
using the asynchronous ``fs.readFile`` and ``fs.writeFile``!

----

So, why did we bother wrapping Promises with Tasks? Why not just use Promises directly?
The problem is that Promises are *impure*, so we can't have good stuff like dead code
removal. But there's another reason: error handling. Here's how it would look if we used
Promises rather than Tasks:

.. code:: javascript

  readFile("foo").then(function (file) {
    // `file` is a string that contains the contents of the file "foo"
  });

It's a bit shorter, but it has a nasty problem: if there's an error with ``readFile``, it will
be *silently ignored*. With Tasks, we *have* to use the ``execute`` function, which always
logs errors to the console, so they are never silently ignored.

Okay, so maybe you're convinced that wrapping stuff in Tasks is a good idea. I mean, you get
good error handling, dead code removal, and all that good stuff, because Tasks are pure.

But the ``execute`` function is impure. And I said that adding in even a *single* impure
function causes problems. So what do we do? First, let's add in a requirement that
every program must have a global variable called ``main``, and that variable must be a Task:

.. code:: javascript

  // Task that reads the file "foo" and then logs it to the console
  var main = do {
    file <- readFile("foo");
    log(file);
  }

And let's hide the ``execute`` function so that you can no longer call it. Instead, the
compiler will automatically add this code to the end of your program:

.. code:: javascript

  execute(main);

In other words, when your program starts, it will automatically execute the ``main`` Task.
Because you cannot call ``execute`` directly, this is the **only** way to execute a Task.

Since you cannot access ``execute``, that means all functions in the language are pure.
And so we gain the various benefits of pure code: the dead code remover can safely remove
**all** code which is not attached to ``main``.

And the compiler can re-arrange things as much as it likes: the ``bind`` function guarantees
that impure things will be executed in the correct order.

And unlike Promises, it's impossible to silently ignore an error: either a Task is attached
to ``main`` and is executed with correct error handling, or it's not executed at all.

We accomplished all of this by separating *execution* and *evaluation*. In JavaScript,
execution can happen at any time. With Tasks, execution only happens with ``main``.

But wait, there's more! Just like with Promises, we can do all kinds of things with Tasks:
we can store them in arrays / objects, pass them to functions, return them from functions,
etc.

Consider this function:

.. code:: javascript

  function forever(task) {
    return do {
      task;
      forever(task);
    }
  }

Now we can execute a Task over and over again, forever:

.. code:: javascript

  var main = forever(log("hi!"));

We did this with just an ordinary function: we didn't need a ``while`` loop, or a macro, or
anything like that.

We can also have a function that executes Tasks in parallel, waiting for all of them to finish:

.. code:: javascript

  function parallel(array) {
    return new Task(function () {
      return Promise.all(array.map(Task_to_Promise));
    });
  }

  var main = parallel([
    doSomething1(),
    doSomething2()
  ]);

Similar things can be done with Promises, but Tasks have dead code removal and correct error
handling. It's also a lot easier to understand how a program works, because everything is
executed from ``main``, rather than having arbitrary execution anywhere.

.. [1] I/O is short for input / output, and it includes things like reading / writing a file,
       sending / receiving stuff over the internet, printing to the console, etc.

.. [2] In Haskell, the ``Task`` type is called ``IO``.

.. [3] A clever reader might point out that because JavaScript has object equality, even if the
       ``action`` and ``args`` are the same, the ``Task`` object itself is different.

       That is correct, but it's also irrelevant to this guide. Haskell has value equality,
       so just pretend that JavaScript has value equality (rather than object equality).

.. [4] In Haskell, the ``bind`` function is called ``>>=``.

       In this guide I focused solely on the ``IO`` type, but the ``>>=``
       function actually works on all monads. ``IO`` is just one of many
       monads: even without ``IO``, monads would still be useful.