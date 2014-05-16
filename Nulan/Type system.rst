Nulan's type system blends structural typing, nominal typing, duck typing, compile-time type checks, run-time type checks, and pattern matching... all together into a single seamless system. The end result is simple, powerful, and can also be optimized to be pretty fast. It allows you to create truly extensible programs.

I'll start with types. In OOP languages [#oop]_ a class is a type. OOP languages [#oop]_ also use *nominal typing*, which means that something can only be of a single type, and two things that are identical in every way can still be treated as different types. To use Python as an example...

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
      (>is x 0))

What the above means is... ``Positive`` is a ``Number`` that is greater than or equal to ``0``. We're treating ``0`` as positive, you'll see why later. So, obviously the ``type`` macro creates new types, but what does that ``isa`` thing mean?

Well, ``Number`` is a built in type that returns true if its argument is a 64-bit floating point JavaScript number. Within a type declaration, ``isa`` basically creates a subset relationship: we're saying that ``Positive`` is a subset of ``Number``. That means any time we need a Number, we can use a Positive as well.

To look at it another way, it just means that something belongs to the ``Positive`` type if and only if *both* the ``Number`` type and ``Positive`` type return true. If either returns false, then it doesn't belong to the ``Positive`` type. Let's create some more types::

    (type Integer (isa Number) -> x
      (is (round x) x))

    (type Ellipse
      { width  = (isa Positive)
        height = (isa Positive) })

    (type Circle (isa Ellipse) -> x
      (is x.width x.height))

The ``Integer`` type is pretty self-explanatory, it simply checks that its argument is an integer. But what about ``Ellipse`` and ``Circle``?

Rather than being a function, a type can also be a dictionary. So, the ``Ellipse`` type says that **any** dictionary that has a ``width`` and ``height`` property which are both ``Positive`` is an ``Ellipse``. This is like structural typing on records in Standard ML. It's also like duck typing but a bit safer, since it requires the dictionary to have *both* ``width`` and ``height`` properties, *and* for the properties to be ``Positive``.

The ``Circle`` type is pretty standard, it just checks that the ``width`` and ``height`` properties of the Ellipse are the same.

So that handles the duck typing/structural typing side of things, but what about nominal typing? Sometimes you really do want two things to be treated as different even if they have the same structure. For that purpose, Nulan lets you use the ``isa`` macro::

    (isa Ellipse { width  = 5
                   height = 5 })

What's going on here? Well, first we created the dictionary ``{ width = 5 height = 5 }`` and then we said that the dictionary is-a ``Ellipse``. What that does is it first checks that the dictionary matches the type (that it has width/height properties that are Positive), and then it *wraps* the dictionary in such a way that it is now recognized as an ``Ellipse``.

Something that has been wrapped in ``Ellipse`` will only be treated as an ``Ellipse``. The above will never be treated as a ``Circle`` even though the ``Circle`` type matches it. This is nominal typing.

Let's create a helper function to create Ellipses::

    (def ellipse -> width height
      (isa Ellipse { width height }))

Now we can create ellipses easily::

    (var my-ellipse = (ellipse 5 5))

This is kinda like creating a class in Python: the ``Ellipse`` type defines the structure of the class, the ``ellipse`` function is like the ``__init__`` method in Python, and ``isa`` actually tags the dictionary as belonging to the class. Unlike in Python, you can change the type of something on the fly::

    (var my-circle = (isa Circle my-ellipse))

What's going on here is... we have ``my-ellipse`` which is wrapped with ``Ellipse``. When we pass it to ``isa``, it first unwraps it, then rewraps it with the ``Circle`` type. So now ``my-circle`` and ``my-ellipse`` are both using the same dictionary, but one is treated as an ``Ellipse`` while the other is treated as a ``Circle``.

You can use this to convert from one type to another type, any time you wish. This is not dangerous at all: in fact, it's idiomatic. It behaves sanely for two reasons:

#. In order to wrap something in a type, the type has to return true. You can never violate the type's contract/assumptions.

#. You're not actually changing the existing type. In the above example, ``my-ellipse`` is one wrapper, and ``my-circle`` is a different wrapper. So when you "change" the type, you're actually just returning a new wrapper. No mutation.

If you want to *unwrap* something so it's treated as structural typing again, you can use ``isa`` without any types::

    (var my-whatever = (isa my-circle))

You can also wrap something in multiple types::

    (var my-positive-integer = (isa Positive Integer 5))

Already this is vastly superior to the nominal typing found in OOP languages [#oop]_.

So, to recap, a type is a function that returns true/false, or a dictionary that specifies required properties. A type can be a subset of 0 or more types. By default Nulan uses structural typing: as long as the type returns true it'll match. But you can wrap things with ``isa`` to have it behave like nominal typing. And you can wrap something with multiple types, and convert from one type to another whenever you want, as long as all the types return true.

Now, how do we actually *use* these types to do things? First off, you can use them with functions::

    (def foo -> (isa Positive Integer x)
      x)

Here we've created a function ``foo`` that requires its first argument to be both ``Positive`` and ``Integer``. It then simply returns its argument unmodified. Notice the syntax is the same as the syntax to wrap something: that's intentional.

If you try to call ``foo`` with an argument that isn't a positive integer, it'll throw an error. This is basically like contract systems found in some languages.

You can also use types for *pattern matching*::

    (def foo -> x
      (match x
        (isa Integer _)
          1
        (isa Positive _)
          2))

If you call ``foo`` with an ``Integer`` it'll return ``1``, or if you call it with a ``Positive`` it'll return ``2``. The cases are tried top-to-bottom, so if you call ``foo`` with a positive integer it'll return ``1``::

    (foo -5)  # returns 1
    (foo 5.5) # returns 2
    (foo 5)   # returns 1

This also works with type wrapping::
 
    (foo 5)                        # returns 1
    (foo (isa Integer 5))          # returns 1
    (foo (isa Positive 5))         # returns 2
    (foo (isa Positive Integer 5)) # error: no matching cases

Notice that even though ``5`` would normally cause ``foo`` to return ``1``, by wrapping it with ``Positive`` we caused it to return ``2``. Also, since we didn't specify a case for the combination of ``Positive`` and ``Integer``, if we wrap it with both, no cases will match.

I saved the best for last: there's one more place where we can use types, and it's where all the magic happens. Nulan has *generic functions*, which are sometimes called *multimethods* in other languages. If you don't know what a generic function/multimethod is, it's basically a function that changes its behavior based on the type of its arguments.

But wait, didn't we already do that just a short while ago with pattern matching? Yes, but the cases were fixed: we did one thing with Integers and another thing with Positives. But what if we want to add more cases? We'd have to go in and change the source code. Generic functions let you add more behavior to a function *without changing the source code*.

How does it work? First, you use the ``generic`` macro to create a generic function::

    (generic sing)
    (generic fly)

Here we created two generic functions called ``sing`` and ``fly``. By default they don't have any behavior, so if you try to call them you'll always get an error. You can then use the ``extend`` macro to add new behavior::

    (type Duck {})
    
    (extend sing -> (isa Duck x)
      "quack")

    (extend fly -> (isa Duck x)
      "flies slowly!")


    (type Sparrow {})
    
    (extend sing -> (isa Sparrow x)
      "chirp chirp")

    (extend fly -> (isa Sparrow x)
      "flies gracefully!")

Heeey, this is like what we did earlier with Python! It sure is, but rather than using methods, we're using generic functions. This is better because generic functions can work with Nulan's module system: a file input module can define a "read" generic function and a book module can define a "read" generic function, and they won't collide!

So, let's try calling the generic functions::

    (sing {})
    (fly {})

Oops, we got an error, why? Well, generic functions have certain rules about how they behave. Since any part of your program can change any generic function at any time... you need some rules so you can keep things sane and easy to understand. One of those rules is that you can't have multiple extensions match the same value. When you called the generic functions, both ``Duck`` and ``Sparrow`` matched! Remember, Nulan uses structural typing by default, and both the Duck and Sparrow types are defined as being an empty dictionary, meaning they have the same structure.

To resolve this is easy, you just use ``isa`` to switch to nominal typing::

    (sing (isa Duck {}))
    (fly (isa Duck {}))

Unlike nominal typing in Python, this is very flexible! Let's say we had some variable ``foo`` and we didn't know what type it was, we can just call it!

::

    (sing foo)
    (fly foo)

If it doesn't match any of the extensions you'll get an error. If it matches multiple extensions you'll get an error, which you can resolve by using ``isa``. And if only one extension matches, it'll be used.

Basically, you can *just call the generic function* without worrying about the types. This gives the same flexibility as duck typing, but it's **vastly** safer: you're almost guaranteed to get errors if something is wrong.

To make things easier, another rule about generic functions is that subtypes always have precedence over supertypes. Remember how an Integer is a subtype of Number, because it uses ``(isa Number)`` in the type declaration?

::

    (generic foo)
    
    (extend foo -> (isa Number x)
      1)

    (extend foo -> (isa Integer x)
      2)

    (foo 5.5)             # returns 1
    (foo 5)               # returns 2

    (foo (isa Number 5))  # returns 1
    (foo (isa Integer 5)) # returns 2

Notice that when we used ``5``, both ``Number`` and ``Integer`` matched, but since ``Integer`` is a subset of ``Number``, it was used instead of throwing an error. We can manually override that by using ``isa``. This can also be used to fulfill the same purpose as ``super`` in Python::

    (type Foo (isa Number))

    (type Bar (isa Foo))


    (generic qux)

    (extend qux -> (isa Foo x)
      (+ x 10))

    (extend qux -> (isa Bar x)
      # call the Foo extension and add 20 to it
      (+ (qux (isa Foo x)) 20))


    (qux 5) # returns 35

What's going on here is that we have two types: Foo is a subset of Number, and Bar is a subset of Foo. So when we call ``qux`` with a number, it uses the extension for ``Bar`` because Bar is a subset of Foo. Now it calls qux again, but this time using ``isa`` to treat it as a Foo, so the Foo extension is called. The above is *very roughly* equivalent to the following Python code::

    class Foo(object):
        def __init__(self, x):
            self.value = x
        def qux(self):
            return self.value + 10

    class Bar(Foo):
        def qux(self):
            return super(Bar, self).qux() + 20

    Bar(5).qux()

So, by using ``isa`` you can choose which extension to call. This lets you emulate ``super`` but is actually much more powerful, since you can choose *any* arbitrary extension, not just the extension for the supertype.

Compared to plain-old functions, generic functions are significantly slower. The reason for this is because they have to check which extensions match, every single time you call the generic function. However, it's possible to *partially* determine the types of things at *compile-time*, removing the overhead of generic functions.

The way it works is that every time you wrap something with ``isa``, the compiler will keep track of it, so if you do this...

::

    (var foo = (isa Number 5))

...then the compiler knows that ``foo`` isa Number. It doesn't know whether ``5`` actually matches the Number type or not (type-checking always happens at run-time), but the compiler can safely *assume* that the Number type matches, because if it didn't... you'd get a run-time error.

Now if you call a generic function...

::

    (some-generic-function foo)

...since the compiler knows that ``foo`` isa Number, it can *do the generic function lookup at compile-time*, making it just as fast as normal function calls. It can also throw an error *at compile-time* if there isn't any matching extension.

Of course this only works if you explicitly tag things with ``isa``, but that's the beauty of this system: if you don't mark things with ``isa``, it just falls back to the slower run-time lookup. So by using ``isa``, you make your program safer and faster, but if you want more flexibility, that's fine too... you'll just pay a price for it. And it's totally fine to mix and match, having parts of your program using ``isa`` and parts not using ``isa``.

One restriction to keep in mind is that the compiler can't know what's inside of a *compound data type* like an array or a dictionary. So this won't be optimized::

    (var foo = { value = (isa Number 5) })

    (some-generic-function foo.value)

But if you use types, Nulan can use that information... for instance::

    (type Foo
      { value = (isa Number) })

    (var foo = (isa Foo { value = 5 }))

    (some-generic-function foo.value)

We know that ``foo`` isa ``Foo`` and that ``Foo`` is a dictionary that has a ``value`` property which isa ``Number``. That's a lot of information that the compiler can use to speed things up! And when it can't, it'll just fall back to run-time lookups.

.. [#oop] When I say "OOP languages", I mean ones like Python, Ruby, JavaScript, Smalltalk, etc.