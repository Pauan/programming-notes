In OOP languages [#oop]_ a class is a type. OOP languages [#oop]_ also use *nominal typing*, which means that something can only be of a single type, and two things that are identical in every way can still be treated as different types. To use Python as an example...

::

    class Duck(object):
        def sing(self):
            return "quack"
        def fly(self):
            return "flies slowly!"

    class Sparrow(object):
        def sing(self):
            return "chirp chirp"
        def fly(self):
            return "flies gracefully!"

    Duck().sing()
    Sparrow().sing()

Even though the two classes ``Duck`` and ``Sparrow`` have the same exact structure (two methods called ``sing`` and ``fly``), they are in fact two separate types. And the only way to make something that is of type ``Duck`` is to use ``Duck()``. And a ``Duck`` will never be a ``Sparrow``, or vice versa: everything in the language has exactly one type.

This is nominal typing.

Python also has something called "duck typing". What this basically means is that you *completely ignore* the type and just *assume* it has a particular structure. For instance, if you have a variable ``foo`` and you don't know what type it is, you would just do this::

    foo.sing()

If it's a ``Duck`` it'll quack, if it's a ``Sparrow`` it'll chirp, and if it's neither, you'll probably get an "attribute missing" error. This is *structural typing*: we only care about the *structure* of the type, not the type itself.

This is very flexible, since we can easily create new types that have a ``sing`` method and they will *just work*! But it also causes *false positives*, where something is treated as a Duck/Sparrow even though it's not. As an example, a ``FileInput`` port and a ``Book`` both have a ``read`` method, but they do completely separate things!

So, nominal typing is safe but inflexible, while structural typing is flexible but unsafe.

Nulan, however, takes a different approach to types. In Nulan, a type is more like a mathematical set, and I think it's a good idea to think of Nulan types as behaving like mathematical sets. Basically, a type is a special function that takes a *single argument* and returns true/false depending on whether its argument belongs to the type or not. Here's an example::

    (type Positive (isa Number) -> x
      (> x 0))

``Number`` is a built-in type that returns true if its argument is a 64-bit floating point JavaScript number. What the above means is... ``Positive`` is a ``Number`` that is greater than ``0``.

So, obviously the ``type`` macro creates new types, but what does that ``isa`` thing mean? In this particular case, ``isa`` basically creates a subset relationship: we're saying that ``Positive`` is a subset of ``Number``. That means anywhere we can use a ``Number``, we can use a ``Positive`` as well.

To look at it another way, it just means that something belongs to the ``Positive`` type if (and only if) *both* the ``Number`` type and ``Positive`` type return true. If either returns false, then it doesn't belong to the ``Positive`` type. Let's create some more types::

    (type Integer (isa Number) -> x
      (is (round x) x))

    (type Ellipse
      { width  = (isa Positive)
        height = (isa Positive) })

    (type Circle (isa Ellipse) -> x
      (is x.width x.height))

The ``Integer`` type is pretty self-explanatory, it simply checks that its argument is an integer. But what about ``Ellipse`` and ``Circle``?

Rather than being a function, a type can also be a dictionary. So, the ``Ellipse`` type says that **any** dictionary that has a ``width`` and ``height`` property which are both ``Positive`` is an ``Ellipse``. This is like structural typing on records in Standard ML. It's also like duck typing but a bit safer, since it requires the dictionary to have *both* ``width`` and ``height`` properties, *and* for the properties to be ``Positive``.

``Circle`` is a standard type that just checks that the ``width`` and ``height`` properties of the ``Ellipse`` are the same.

To test whether a particular thing matches a type, you can use ``isa?``::

    (isa? { width  = 5
            height = 5 } Circle)

The above checks that the ``{ width = 5 height = 5 }`` dictionary matches the ``Circle`` type. In this case it does, so ``isa?`` returns true.

So that handles the duck typing/structural typing side of things, but what about nominal typing? Sometimes you really do want two things to be treated as different even if they have the same structure. For that purpose, Nulan lets you use the ``new`` macro::

    (new Ellipse { width  = 5
                   height = 5 })

What's going on here? Well, first we created the dictionary ``{ width = 5 height = 5 }`` and passed it to the ``new`` function. The ``new`` function checked that the dictionary matched the ``Ellipse`` type, then it *wrapped* the dictionary in such a way that it is recognized as an ``Ellipse``, and lastly it returned the wrapper.

Something that has been wrapped in ``Ellipse`` will only be treated as an ``Ellipse``. The above will never be treated as a ``Circle`` even though the ``Circle`` type matches it. This is nominal typing.

Let's create a helper function to create ellipses::

    (def ellipse -> width height
      (new Ellipse { width height }))

Now we can create ellipses easily::

    (var my-ellipse = (ellipse 5 5))

This is kinda like creating a class in Python: the ``Ellipse`` type defines the structure of the class, the ``ellipse`` function is like the ``__init__`` method in Python, and ``new`` actually tags the dictionary as belonging to the class::

    class Ellipse(object):
        def __init__(self, width, height):
            self.width = width
            self.height = height

    my_ellipse = Ellipse(5, 5)

Unlike in Python, you can change the type of something on the fly::

    (var my-circle = (new Circle my-ellipse))

What's going on here is... we have ``my-ellipse`` which is wrapped with ``Ellipse``. When we pass it to ``new``, it first unwraps it, then rewraps it with the ``Circle`` type. So now ``my-circle`` and ``my-ellipse`` are both using the same dictionary, but one is treated as an ``Ellipse`` while the other is treated as a ``Circle``.

You can use this to convert from one type to another type, any time you wish. This is not dangerous at all: in fact, it's idiomatic. It behaves sanely for two reasons:

#. In order to wrap something in a type, the type has to return true. You can never violate the type's contract/assumptions.

#. You're not actually changing the existing type. In the above example, ``my-ellipse`` is one wrapper, and ``my-circle`` is a different wrapper. So when you "change" the type, you're actually just returning a new wrapper. No mutation.

You can also wrap something in multiple types::

    (var my-positive-integer = (new Positive Integer 5))

Already this is vastly superior to the nominal typing found in OOP languages [#oop]_.

So, to recap, a type is a function that returns true/false, or a dictionary that specifies required properties. A type can be a subset of 0 or more types. By default Nulan uses structural typing: as long as the type returns true it'll match. But you can wrap things with ``new`` to have it behave like nominal typing. And you can wrap something with multiple types, and convert from one type to another whenever you want, as long as all the types return true.

Now, how do we actually *use* these types to do things? First off, you can use them with functions::

    (def foo -> (new Positive Integer x)
      x)

Here we've created a function ``foo`` that requires its first argument to be both ``Positive`` and ``Integer``. It then simply returns its argument unmodified. Notice the syntax is the same as the syntax to wrap something: that's intentional.

If you try to call ``foo`` with an argument that isn't a ``Positive Integer``, it'll throw an error::

    (foo 5)                        # error
    (foo (new Positive Integer 5)) # works

You can also use types for *pattern matching*::

    (def foo -> x
      (match x
        (new Integer _)
          1
        (new Positive _)
          2))

If you call ``foo`` with an ``Integer`` it'll return ``1``. If you call it with a ``Positive`` it'll return ``2``. The cases are tried top-to-bottom, so if you call ``foo`` with a ``Positive Integer`` it'll return ``1``::

    (foo (new Integer -5))         # returns 1
    (foo (new Positive 5.5))       # returns 2
    (foo (new Positive Integer 5)) # returns 1

I saved the best for last: there's one more place where we can use types, and it's where all the magic happens. Nulan has *generic functions*, which are sometimes called *multimethods* in other languages. If you don't know what a generic function/multimethod is, it's basically a function that changes its behavior based on the type of its arguments.

But wait, didn't we just do that with pattern matching? Yes, but the cases were fixed: we did one thing with ``Integer`` and another thing with ``Positive``. But what if we want to add more cases? We'd have to go in and change the source code. Generic functions let you add more behavior to a function *without changing the source code*.

How does it work? First, you use the ``generic`` macro to create a generic function::

    (generic sing)
    (generic fly)

Here we created two generic functions called ``sing`` and ``fly``. By default they don't have any behavior, so if you try to call them you'll always get an error.

You can then use the ``extend`` macro to add new behavior::

    (type Duck {})

    (def duck ->
      (new Duck {}))

    (extend sing -> (new Duck x)
      "quack")

    (extend fly -> (new Duck x)
      "flies slowly!")


    (type Sparrow {})

    (def sparrow ->
      (new Sparrow {}))
    
    (extend sing -> (new Sparrow x)
      "chirp chirp")

    (extend fly -> (new Sparrow x)
      "flies gracefully!")

Heeey, this is like what we did earlier with Python! It sure is, but rather than using methods, we're using generic functions. This is better because generic functions can work with Nulan's module system: a file input module can define a ``read`` generic function, a book module can define a ``read`` generic function, and they won't collide!

So, let's try calling the generic functions::

    (sing (duck))    # returns "quack"
    (sing (sparrow)) # returns "chirp chirp"

    (fly (duck))     # returns "flies slowly!"
    (fly (sparrow))  # returns "flies gracefully!"

Hey, sweet, it worked! This is just as flexible as duck-typing in Python. Let's say we had some variable ``foo`` and we didn't know what type it was... we can just use it!

::

    (sing foo)
    (fly foo)

If none of the types match you'll get an error. Basically, you can *just call the generic function* without worrying about the types. And unlike in Python, there's no chance for *false positives*: a file input module can have a ``read`` generic function... a book module can have a ``read`` generic function... and they won't collide! You can easily have a type that extends both the file input ``read`` and the book ``read``, without any ambiguity!

By the way, as a convenience, you can also do this...

::

    (generic foo -> (isa Foo x)
      ...)

...which is exactly the same as this::

    (generic foo)
    (extend foo -> (isa Foo x)
      ...)

Also, because we can convert between types, we get Python's ``super`` for free::

    (type Event
      { listeners = (isa Array) })

    (def event ->
      (new Event { listeners = [] }))

    (generic on -> (new Event { listeners }) f
      (push listeners f))

    (generic send -> (new Event { listeners }) value
      (each listeners -> f
        (f value)))


    (type Signal (isa Event)
      { value })

    (def signal -> value
      (new Signal { value listeners = [] }))

    (generic current -> (new Signal { value })
      value)

    (extend on -> (new Signal x) f
      (do (f x.value)
          (on (new Event x))))

    (extend send -> (new Signal x) value
      (do (<= x.value value)
          (send (new Event x))))

What's going on here is that we have a type for event listeners called ``Event``. As you can see, it has an array of listeners. We can use ``on`` to add new listeners and ``send`` to send a value to the listeners. If you've used the DOM, ``on`` is like ``addEventListener`` and ``send`` is like ``dispatchEvent``.

We also have a ``Signal`` type, which is the same as an ``Event`` except it also has a *current value*. This is useful for things like, say, the mouse cursor. You might want to get the current x/y coordinates of the mouse cursor... but also be notified when the x/y coordinates change.

When you call ``on`` with a ``Signal`` it behaves the same as calling ``on`` with an ``Event`` except it'll also call the function straight away. And calling ``send`` with a ``Signal`` is the same as calling ``send`` with an ``Event`` except it'll also update the current value of the signal.

Notice that the actual code exactly follows the above description: we first do something specific to ``Signal`` and then we call ``on``/``send`` again... but we use ``(new Event x)`` so that the ``Signal`` is temporarily treated as an ``Event``. This is equivalent to the following Python code::

    class Event(object):
        def __init__(self):
            self.listeners = []

        def on(self, f):
            self.listeners.append(f)

        def send(self, value):
            for f in self.listeners:
                f(value)

    class Signal(Event):
        def __init__(self, value):
            self.listeners = []
            self.value = value

        def current(self):
            return self.value

        def on(self, f):
            f(self.value)
            super(Signal, self).on(f)

        def send(self, value):
            self.value = value
            super(Signal, self).send(value)

But unlike Python's ``super``, you can convert from any type to any type (as long as the types match), so you can precisely specify exactly which behavior to use rather than always using the behavior for the supertype.

.. [#oop] When I say "OOP languages", I mean ones like Python, Ruby, JavaScript, Smalltalk, etc.