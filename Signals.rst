I had heard the term "functional reactive programming" from others, but I
didn't understand what it was or why it was useful.

It took me a while, but now I do understand those things. So I will now try
to explain to you what Functional Reactive Programming (FRP) means, and also
why you should use it.

Let's start with the first word, "functional". A functional program is a
program that emphasizes the mathematical concept of a function. What that means
is that a functional program has functions (obviously), and these functions can
take in values as *input* (which we call the function's *arguments*), and can
*output* a value (which we call *returning*).

In this way of writing programs, each function is a black box: you feed it
input, and you get output. In addition, there is the restriction that if you
feed the same input to a function, the output must always be the same.

After all, in math, ``2 + 2`` is always ``4``. It isn't *sometimes* ``4`` and
*sometimes* something else. For the inputs ``2`` and ``2``, the ``+`` function
will **always** return ``4``, no exceptions.

This means the only way to change the output of a function is to change the
inputs. This means a function cannot rely upon mutable state. For instance,
consider this JavaScript program::
  
  function add(x, y) {
    return x + y
  }

Now, if you call ``add(2, 2)`` it will return ``4`` as you expect. And it will
always return the same output when given the same input. And therefore ``add``
is a *pure* function.

But now consider this function::

  var foo = 0
  
  function add(x, y) {
    return foo + x + y
  }

If we call ``add(2, 2)`` we still get ``4``, which is good. But now if we
change the variable ``foo`` to ``5``, then ``add(2, 2)`` now returns ``9``!
Even though we gave the same inputs to the function, its output is now
different! This is an *impure* function.

Mutable variables and classes are common in most languages, but functional
languages either flat-out don't allow for mutation, or it's allowed but heavily
discouraged.

One might wonder *why* people would choose to use a language that restricts
certain features, and the reason is that it makes programs easier to
understand.

An example of where a restriction is *useful* is lexical scope. Languages which
use dynamic scope tend to be harder to understand, because the meaning of
variables is determined by where the function is called, not where it's
defined.

A language with lexical scope restricts how variables behave, but the end
result is that programs are now easier to understand, precisely because they're
restricted.

Imagine a language where any part of the program can completely change any
other part. It would be super easy to write crazy spaghetti code in such a
language. It would also drastically increase the chances of various libraries
accidentally clobbering each other, making it harder to combine multiple
libraries in a single project.

So, obviously, some restrictions are good. Whether you think the *particular*
restrictions imposed by functional languages are good or not... well, that's
up to you. I won't try to convince you that functional programming is good.
At least, not in here.

The reason I'm mentioning all this is because functional reactive programming
was developed for functional programming languages. In normal imperative/OOP
languages, the concept of time is implicit: your program executes one
statement, then another, then another...

Changes in state happen due to mutation, and this state happens at a particular
time, but you don't really think much about that. You just mutate things and
hope for the best, only worrying about it when things go wrong.

In functional languages, though, you have pure functions that take input and
return output. There's no concept of time. This makes it difficult to create
things like GUIs, since things like a user clicking on the mouse or typing on
the keyboard can happen at any time, so you can't make it work with pure
functions.

And so, Functional Reactive Programming was born. Unlike in imperative/OOP
languages where time happens implicitly... with FRP, you explicitly deal with
time. In essence, we've taken the concept of time, and turned it into a value.

Since time is now a value, you can pass it to functions and return it from
functions. You can now deal with time in a pure way. That is the motivation
behind FRP.

Okay, but you don't use some fancy-pants functional language, why should *you*
care about FRP? Because it's useful even in imperative/OOP languages, that's
why.

To explain this, let's move onto the second word in FRP: "reactive". A reactive
program is one that, well, reacts to changes. You can think of it as being
kinda like event-driven programming on steroids.

A great example of a reactive program is a spreadsheet, like Excel. In Excel,
you've got this big table with rows and columns and cells. You can type in
some stuff in a cell, and then type in some stuff in another cell...

That's nice and all, but what's *really* cool is that you can have a cell which
*depends upon* the stuff in another cell. Consider this spreadsheet::

   ___________________________________
  |        |        |        |        |
  |        |    1   |    2   |    3   |
  |________|________|________|________|
  |        |        |        |        |
  |    A   |   20   |   50   | =A1+A2 |
  |________|________|________|________|

That is, the value of cell A1 is ``20``, the value of cell A2 is ``50``, and
the value of cell A3 is ``A1+A2``, which is ``70``.

Now, the awesome thing about this is, if you change A1 or A2, then A3 will
*automatically* change. And then if you have another cell that depends on A3,
it will *also* change. So the entire spreadsheet is kept in sync at all times.

And that, fundamentally, is what the "reactive" means in FRP: you can have
values that depend upon other values. When a value changes, anything that
depends upon it changes as well.

This is immensely useful for GUIs. You have some backend code, maybe connecting
to a database or whatever, and you want to display it to the user. And then you
want to let the user modify stuff, perhaps by clicking or typing things in, and
you want those changes to automatically be stored in the database.

Trying to make sure that everything stays in sync is tough to do, and it's easy
to get it wrong. FRP can help make it a little bit easier, by automatically
syncing everything, just like in a spreadsheet.

And finally we get to the last word in FRP: "programming". Hopefully this one
is pretty obvious. But it does emphasize that FRP applies to programming
languages, and not, say, spreadsheets. So how *do* you take the idea of
spreadsheets and transfer it into programming languages?

I'll be using JavaScript for these examples, partly because it's a very
popular language, partly because it shows that FRP can work even in a
non-functional language, and partly because I have already written a
substantial JavaScript program that uses FRP.

First, you create a *signal*. A signal is a *value that changes over time*::

  var foo = signal.create(5)

You can get the current value of a signal::

  foo.get() // returns 5

And you can also change the current value of a signal::

  foo.set(10) // now the signal is 10 rather than 5

Thus far, this is no better than plain old variables. But now the fun begins.
You can *map* a signal::

  var bar = signal.map(foo, function (foo) {
    return foo + 20
  })

``signal.map`` takes a signal and a function. It calls the function with the
current value of the signal. Whatever the function returns is put into a *new*
signal, which is then returned by ``signal.map``.

In addition, whenever the input signal changes, ``signal.map`` will run the
function again, and will then change the output signal to whatever the
function returns.

Essentially, we're taking a signal and returning a signal, but with a function
mapped over it. This is the same as calling ``map`` on a list, except rather
than calling a function on every element of the list and returning a new list,
it calls a function on the current and future values of a signal, and returns a
new signal.

Now, if we call ``bar.get()`` we will get ``30`` as we expect. And if we
change ``foo``...

::

  foo.set(50)

...then ``bar.get()`` will now be ``70``. It automatically changed when the
input signal changed.

Also, it's common to have a function depend upon multiple signals, so there is
a ``signal.bind`` function which does just that::

  var qux = signal.bind([foo, bar], function (foo, bar) {
    return foo + bar
  })

``qux`` is a signal which adds the value of ``foo`` and ``bar`` together. Right
now ``qux.get()`` is ``120``, but if *either* ``foo`` or ``bar`` change, then
``qux`` will automatically change as well.

We can also do other normal stuff like ``foldl`` or ``filter``::

  // a signal that returns the sum of all values of the signal foo
  var sum = signal.foldl(foo, 0, function (x, y) {
    return x + y
  })
  
  // a signal that only includes the values of foo that are even
  var even = signal.filter(foo, 0, function (foo) {
    return foo % 2 === 0
  })

As you can see, they take a signal as their input, and returns a signal as
their output. ``foldl`` takes an initial argument, which is normal. But it's
strange that ``filter`` also takes an initial argument.

But if you think about it, it makes sense. A signal must always have a current
value. And ``signal.filter`` creates a signal which is the same as another
signal, but excluding certain values.

So what if the filter function doesn't include any values?

::

  signal.filter(foo, function (foo) {
    return false
  })

The above returns a signal that excludes all the values from ``foo``. But since
we've excluded all the values, there's no value for the returned signal! So we
have to provide an initial value in case there's no value::

  signal.filter(foo, 0, function (foo) {
    return false
  })

Now the returned signal has an initial value of ``0``, and will change as soon
as the filter function returns true.

All this signal stuff is very different from the way JavaScript does things. In
JavaScript, there are two primary ways to deal with time: callbacks and event
listeners.

Callbacks let you wait for a single value which will arrive in the future. This
system is used extensively in Node.js, but not nearly as much in the browser.
I won't talk about callbacks here because they only let you wait for a *single*
value, whereas signals are about *multiple* values over time.

So let's compare signals with event listeners, which are the JavaScript way of
waiting for multiple values over time. That sounds pretty weird though, right?
I mean, you don't think of event listeners as "waiting for multiple values over
time", right?

But essentially that's what they are. When you use event listeners, the same
function will indeed be called with many different arguments, over time. But we
don't think of them that way, because in JavaScript, time is implicit and
mutation is everywhere. Instead we think of them as "waiting for changes" to a
DOM node or an object or whatever.

The biggest difference between events and signals is that *signals always have
a current value*, whereas events *do not have a value at all*. This might seem
like a really minor thing, but it actually is *very* significant!

To explain why, let's consider two different JavaScript programs, one written
with FRP signals, and one with normal event listeners::

  // FRP Signals
  var e = document.getElementById("foo")

  signal.bind([e.mouseover], function (over) {
    if (over) {
      e.classList.add("hover")
    } else {
      e.classList.remove("hover")
    }
  })

::

  // Event Listeners
  var e = document.getElementById("foo")

  e.addEventListener("mouseover", function () {
    e.classList.add("hover")
  }, true)

  e.addEventListener("mouseout", function () {
    e.classList.remove("hover")
  }, true)

So, the FRP program needs a bit of explaining. The idea is that DOM nodes,
rather than having event listeners, instead represent their state as signals.
So rather than having ``mouseover`` and ``mouseout`` events, they would have a
single ``mouseover`` property. This property is a signal, whose value is either
``true`` or ``false``.

In other words, if the mouse is *currently* over the DOM node, then
``e.mouseover.get()`` will be true, and if not, then it will be false. And when
the user moves the mouse over the element, or away from the element, then the
signal will change accordingly. And of course it's a signal, so it can be
bound, mapped, filtered, etc. just like any other signal.

Looking at the above, the FRP solution doesn't really seem any better! In fact,
you could even argue that the event listener solution is better.

For simple examples, the benefits of FRP are not clear. So let's make it just
a teensy tiny bit more complex. Let's suppose that the element "foo" can
sometimes be *disabled*, meaning that the user can't interact with it in any
way.

In the above code, the element's class changes when hovering over it,
presumably changing how the element looks. While the element is disabled, we
would like for it to not use the "hover" class, even when hovering.

With signals, this is easy::

  var e = document.getElementById("foo")

  var disabled = signal.create(false)

  signal.bind([e.mouseover, disabled], function (over, disabled) {
    if (over && !disabled) {
      e.classList.add("hover")
    } else {
      e.classList.remove("hover")
    }
  })

Wow, look at that, the code is pretty much exactly the same. We just slapped
on a ``disabled`` signal. Piece of cake. And the code remains very
understandable: when the mouse is over the element, and it's not disabled,
add this class, otherwise remove it.

With event listeners, things get hairy...

::

  var e = document.getElementById("foo")

  var disabled = false

  function enable() {
    disabled = false
    if (isHovering) {
      e.classList.add("hover")
    }
  }
  
  function disable() {
    disabled = true
    e.classList.remove("hover")
  }

  var isHovering = false

  e.addEventListener("mouseover", function () {
    isHovering = true
    if (!disabled) {
      e.classList.add("hover")
    }
  }, true)

  e.addEventListener("mouseout", function () {
    isHovering = false
    e.classList.remove("hover")
  }, true)

::

The code is obviously much more complicated and harder to understand.
Ironically, you can make it easier to understand... by emulating signals::

  var e = document.getElementById("foo")

  var disabled = false
  
  function changeDisable(x) {
    disabled = x
    updateHover()
  }
  
  function updateHover() {
    if (isHovering && !disabled) {
      e.classList.add("hover")
    } else {
      e.classList.remove("hover")
    }
  }

  var isHovering = false

  e.addEventListener("mouseover", function () {
    isHovering = true
    updateHover()
  }, true)

  e.addEventListener("mouseout", function () {
    isHovering = false
    updateHover()
  }, true)

But even then it's still pretty verbose and clunky. And if you're going to
emulate signals anyways, why not just use signals in the first place?

Right about now you're probably jumping up and down and screaming at me that
I should write it like this instead::

  var e = document.getElementById("foo")

  function enable(e) {
    e.classList.remove("disabled")
  }
  
  function disable(e) {
    e.classList.add("disabled")
  }
  
  e.addEventListener("mouseover", function () {
    e.classList.add("hover")
  }, true)

  e.addEventListener("mouseout", function () {
    e.classList.remove("hover")
  }, true)

But this only works if you're changing the element's class. If you want to do
programmy stuff that doesn't involve changing the element's class, then you're
still screwed.

And, I would like to point out that even though this solution is *very* clean
and easy to understand, it still manages to be a bit longer than the solution
that uses signals.

So hopefully I've demonstrated that signals can be put to good use in GUI code,
even in a non-functional imperative language like JavaScript.

I've also found other nifty uses for signals. A common situation is wanting to
know when the DOM is ready, so you can do your JavaScripty stuff on it::

  signal.when(document.ready, function () {
    DOSTUFF()
  })

The above code reads very nicely: "when the document is ready, do this".

How it works is... ``signal.when`` takes a signal and a function. If the
signal's value is true, it will immediately call the function. Otherwise, it
will wait until the signal's value is true, and will then call the function.

``document.ready`` is a signal whose value is either true or false depending on
whether the DOM is ready or not.

Without signals, the standard way to do this is to use ``document.readyState``
and the "DOMContentLoaded" event, like so::

  if (document.readyState !== "loading") {
    DOSTUFF()
  } else {
    addEventListener("DOMContentLoaded", function () {
      DOSTUFF()
    }, true)
  }

You need both, because if the DOM is already loaded by the time your code runs,
it won't ever fire the "DOMContentLoaded" event. So you first need to check if
the DOM is loaded. If so, great, just run the code. If not, wait until the DOM
is loaded and then run the code.

This is a pain, obviously, so there's pleeeenty of libraries out there that do
this for you. As an example, in jQuery you can just do this::

  $(document).ready(function () {
    DOSTUFF()
  })

Neato. But this pattern of "wait until this thing is loaded and then run this
code" is pretty common.

Let's suppose we want to use a library. This library needs to do some async
stuff before it's loaded and ready to use. Maybe it's talking to a database or
whatever, doesn't matter.

So we want to wait until both the library **and** the DOM are loaded before
running our code.

With signals, this is trivial::

  // library code
  var loaded = signal.create(false)
  
  // do async stuff here
  loaded.set(true)

  // your code
  signal.when(signal.and(document.ready, loaded), function () {
    DOSTUFF()
  })

The library defines a variable ``loaded`` which is a signal which has the
value ``false``. When the library is done loading, it will then set the signal
to ``true``.

What ``signal.and`` does is, it takes multiple signals and returns a new signal
which is the logical AND of the input signals. So in this case, it returns a
new signal which is true only when both ``document.ready`` and ``loaded`` are
true.

Now let's try doing this without signals...

::

  // library code
  var loaded = false

  function waitUntilLoaded(f) {
    // do async stuff here
    loaded = true
    f()
  }

  // your code
  var i = 2

  function done() {
    if (--i === 0) {
      DOSTUFF()
    }
  }

  if (document.readyState !== "loading") {
    done()
  } else {
    addEventListener("DOMContentLoaded", done, true)
  }

  if (loaded) {
    done()
  } else {
    waitUntilLoaded(done)
  }

Gosh what a pain. We have to manually keep track of whether the library is
loaded or not, and if it's not, then call ``waitUntilLoaded``. This is pretty
much the same thing we have to do with ``document.readyState``.

And even worse, we have to use a counter ``i`` to keep track of when both the
events are done.

We can make this easier by abstracting this out a bit...

::

  // library code
  var loaded = false

  var waiting = []

  function waitUntilLoaded(f) {
    if (loaded) {
      f()
    } else {
      waiting.push(f)
    }
  }
  
  // do async stuff here
  loaded = true
  waiting.forEach(function (f) {
    f()
  })
  waiting = null

  // your code
  function ready(f) {
    if (document.readyState !== "loading") {
      f()
    } else {
      addEventListener("DOMContentLoaded", f, true)
    }
  }
  
  ready(function () {
    waitUntilLoaded(function () {
      DOSTUFF()
    })
  })

This is a bit better, but... if you are waiting for multiple things, you'll end
up with deeply nested callbacks. In addition, for every library that wants to
support this, they need to have their own implementation of ``loading`` and
``waitUntilLoaded``. Compare that with the version that uses signals, which is
vastly shorter and easier to read, write, and understand.

You could argue that this is unfair, since any library that uses signals would
obviously depend on the signal library. And so, why not create a library that
handles async loading?

::

  var loaded = asyncLoader()
  
  // do async stuff here
  loaded.done()
  
  // your code
  dom.ready(function () {
    loaded.ready(function () {
      DOSTUFF()
    })
  })

Ahh, much better! Except, you still end up with callback hell.

Also, creating a library specifically to handle async loading seems hacky to
me. Instead, you can use signals which handle time in a variety of situations
beyond async loading.

-----

And for fun, all the above examples, but in Nulan::

  (map e.mouseover -> over
    (dom/class e "hover" over))

  (var disabled = (dedupe false))

  (mapzip e.mouseover disabled -> over disabled
    (dom/class e "hover" (and over (not disabled))))

  (when dom/ready ->
    (DOSTUFF))

  # library code
  (var loaded = (dedupe false))

  # do async stuff here
  (push loaded true)

  # your code
  (when (and dom/ready loaded) ->
    (DOSTUFF))