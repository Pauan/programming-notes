Traditional OOP languages (including but not limited to Java, Ruby, SmallTalk,
Python, and JavaScript) represent programs as a bunch of "classes". Each class
is essentially a new type, which can contain various attributes (data) and
methods (behavior).

This way of writing programs tends to be brittle and hard to extend. If the
language tries to solve this problem while continuing to use traditional
methods, the end result is a language which is quite complex.

Making behavior separate from data provides a way to write flexible and
extendable programs while keeping the language simple.

I will now show examples (in Python) to demonstrate this claim.

Consider the classes ``FileInput``, ``Iterator``, and ``Book``::

  class FileInput:
    def read(self):
      ...

  class Iterator:
    def next(self):
      ...

  class Book:
    def read(self):
      ...

That is, a ``FileInput`` class has a ``read`` method, an ``Iterator`` class
has a ``next`` method, and a ``Book`` class has a ``read`` method.

If you have a variable ``foo`` and you want to call the ``next`` method, you
can do this::

  foo.next()

Now, what if you want to call the ``read`` method? You could just use
``foo.read()``, but *depending on the type of* ``foo``, it will call either
``FileInput.read`` or ``Book.read``.

The problem is that ``FileInput.read`` has vastly different behavior than
``Book.read``, so it's important to know which method you are calling!

OOP languages "solve" this problem by giving you a way to know the type of
something::

  assert isinstance(foo, Book)
  foo.read()

The above code makes sure that ``foo`` is of type ``Book``, therefore
guaranteeing that ``foo.read()`` will call ``Book.read`` and not
``FileInput.read``.

At first, this seems to solve the problem. But now we have another problem.
What if we want to create a new class that is *similar* to a ``Book``?
The OOP way to do that is sub-classing::

  class MyBook(Book):
    def read(self):
      ...

The above code creates a class ``MyBook`` that *inherits* from the class
``Book``. That means two things. First, it means that ``MyBook`` automatically
inherits all the attributes and methods from ``Book``. Secondly, it means any
place in the program that expects a ``Book`` will also work with ``MyBook``.

So far so good, right? But now let's suppose we want ``MyBook`` to *also* be
usable as a ``FileInput`` or ``Iterator``. Some OOP languages don't even
support this at all. Python, however, does support it with
multiple-inheritance::

  class MyBook(Book, FileInput, Iterator):
    def read(self):
      ...

Oops, this doesn't work. We want to define some behavior for when ``MyBook``
is used as a ``FileInput``, and different behavior when it's used as a
``Book``. But both ``FileInput`` and ``Book`` define a method called ``read``,
and there's no way to distinguish between ``FileInput.read`` and
``Book.read``.

In addition, multiple-inheritance is complicated to implement and complicated
to use. The order of looking up a method in the class hierarchy is
non-trivial.

When you are reading some code and you see a class that inherits from multiple
classes, do you really want to sit there and try to figure out which method is
being called based on the multiple-inheritance algorithm?

These problems are a direct result of bundling data and behavior together. In
OOP languages, anytime you want to define behavior, you must do so in a class.
If you want to add new behavior to an existing type, you must create a
sub-class.

This leads to a huge amount of sub-classes, way more than is necessary. In
addition, if the inheritance hierarchy was not well designed from the
start, your system will be very inextensible, because *the only way to
extend a program is to create a sub-class*.

Python tries to work around this problem by using "duck-typing", which means
that you would just call ``foo.read()`` and not check its type at all.

But two different classes that both define a method with the same name can
have *very* different behavior (e.g. ``FileInput`` and ``Book``). In the
*best case* you'll get an error, which is what you want. In a *worse* case
you'll get subtle bugs that are hard to track down. In the **worst case**
you'll get nasty things like data corruption. It would be nice if duck-typing
were a bit safer.

Python introduced `Abstract Base Classes <http://legacy.python.org/dev/peps/pep-3119/>`_
which allows you to do duck-typing in a safer way, but it *still* doesn't
solve the problem of wanting ``MyBook`` to have different behavior when used
as a ``FileInput`` and when used as a ``Book``.

So, Python has classes, instances, bound/unbound methods, multiple
inheritance, *and* abstract base classes, yet it *still* can't solve this
problem? Python keeps piling complexity on top of complexity, but perhaps
we can find a simpler solution, rather than adding on yet-another ad-hoc
feature.

----

Looking at another language, Ruby allows for "open classes", which means that
you can add new methods to an existing class without creating a sub-class::

  class String
    def foo
      ...
    end
  end

The above code adds a new ``foo`` method to the *already existing* ``String``
class. It does not create a sub-class, but instead modifies the existing
class.

The problem with this is that it's very easy for different parts of the
program to accidentally collide. As an example, let's suppose two different
libraries both add a ``trim_right`` method to the ``String`` class.

You might reasonably want to choose which method to use, or perhaps even use
both, but that's impossible. Whichever method was defined last will overwrite
the previous method.

There is a common pattern here about method names colliding. Some languages
use a namespace or module system to prevent *variables* from colliding, but
most languages do *not* use a namespace system to prevent *methods* from
colliding.

So, now that I have demonstrated that standard OOP techniques (including
duck-typing, multiple-inheritance, abstract base classes, and open classes)
are lacking, how can we fix it?

There are many ways, but I'm going to focus on one way in particular.

----

The first step is to decouple behavior from data. Classes should define *data*
only, not behavior. But, then how do we define behavior? Answer: functions.

Consider a hypothetical Python language, which I will call Python+.

In Python+ there is a "generic" keyword::

  generic foo

The above creates a generic function called ``foo``. As you can see, we've
specified a name and nothing else.

A generic function is identical to a normal function, except its behavior
changes depending on the type of its first argument.

How do we define its behavior, then? We use the ``extend`` keyword::

  extend foo(x is Bar):
    ...

The above means, "when the ``foo`` function is called with a type of ``Bar``
as its first argument, then do this".

And we can then add more behavior for a different type::

  extend foo(x is Qux):
    ...

The above code behaves the same as this::

  def foo(x):
    if isinstance(x, Bar):
      ...
    elif isinstance(x, Qux):
      ...
    else:
      raise TypeError()

The difference is that we can add new types dynamically, rather than
hardcoding them in an ``if``.

As a convenience, rather than writing this::

  generic foo

  extend foo(x is Bar):
    ...

You can instead write this, which does exactly the same thing::

  generic foo(x is Bar):
    ...

----

Let's start by defining the ``FileInput`` class, but this time with behavior
decoupled from data::

  module file:
    class FileInput:
      pass

    generic read(x is FileInput):
      ...

Okay, great! Now let's do the same for ``Book``::

  module book:
    class Book:
      pass

    generic read(x is Book):
      ...

Now, it's important to note that although these two generic functions are both
called ``read``, they are *actually different functions*. Because they use
Python's already-existing module system, you can use both of them without name
collisions::

  import book
  import file

  book.read(...)
  file.read(...)

Now let's define the ``MyBook`` class::

  module mybook:
    import book
    import file

    class MyBook(book.Book):
      pass

    extend book.read(x is MyBook):
      ...

    extend file.read(x is MyBook):
      ...

Notice we did not need to make ``MyBook`` inherit from ``FileInput``: we can
extend existing behavior to work with new types, without inheritance.

And, we've successfully defined different behavior when ``MyBook`` is used as
a book, and when it's used as a file input!

Now, let's suppose later on we define an ``Iterator`` class::

  module iter:
    class Iterator:
      pass

    generic next(x is Iterator):
      ...

And now we want ``MyBook`` to work as an iterator. No problem!

::

  import iter
  import mybook

  extend iter.next(x is mybook.MyBook):
    ...

We just dynamically extended an already-existing class to work with new
behavior! And unlike open classes in Ruby, there is *no name collisions*,
because the generic functions are scoped per module.

This leads to *truly* extensible systems, where new behavior can be added
to existing classes at any time, and new classes can be added at any time
and made to work with existing behavior.

And unlike duck-typing or Ruby's open classes, this is *safe*: if you try to
call ``book.read`` on something that isn't a book, it will throw an error.

In addition, this is *just as fast* as existing Python code, because it uses
the same single-dispatch system.

----

Note: these "generic functions" are essentially multimethods, except they only
dispatch on the type of the first argument. This allows them to be really
really fast.

It is possible to add multiple-dispatch later on, in a backward-compatible
way. But it is tricky to have full multimethods while keeping the speed of
single dispatch. Which is why these generic functions only dispatch on the
first argument.

If you're familiar with Clojure, these "generic functions" are *extremely
similar to* protocols, **except** you can create *individual* generic
functions *without* bundling them together into a protocol.

It is possible to add a protocol/interface/abstract base class layer on top
of generic functions. But it's also possible to just use individual generic
functions, without an explicit protocol/interface. It's up to you, the
language designer.
