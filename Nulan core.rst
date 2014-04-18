This file contains Nulan code. To be more specific, it contains Nulan code
that will be part of the core library, which is automatically loaded, and
is thus available to all Nulan programs.

The code here is not actually runnable right now (the Nulan compiler is not
even close to being finished), but it still serves as an example of what Nulan
code looks like, and also displays some of the features that Nulan has.

One day, when the Nulan compiler is finished, I should be able to copy-paste
this code in and have it work. In the meantime, by writing this code *now*,
I can clarify ideas before actually implementing the Nulan compiler. This
helps me to find various bugs and discover problems that might make an idea
impractical or impossible.

Nulan is intentionally designed as a *practical* language. That means it has
to be fast, so I automatically exclude any ideas that would be impractically
slow. All the ideas in here, even the ones that seem crazy, should be
implementable in a fast way.

It also means Nulan needs to make many hard decisions, like about
interoperability with the host language. So I try to strike a balance between
being fast, being good, and being interoperable.

Anyways, onto the code!

::

  # Reuse JavaScript's Object constructor for speed
  # TODO is this any faster than creating a new type ?
  (external/type Any = Object)

  # everything implicitly inherits from Any
  # TODO check if having types actually inherit from Type is slow
  # TODO types should inherit from Type, but Type should inherit from Any, which is also a type...
  #      not sure how I'm going to handle this circularity
  (type Type)

  # TODO can't use because although JavaScript allows any function to be a constructor,
  # I want Nulan to be a bit more restrictive
  #(external/type Type = Function)

  # TODO how fast is using splice with external/new ?
  # TODO does using splice with external/new cause problems with optimizations in V8 ?
  # TODO does making new into a function rather than a macro cause various optimization issues in V8 ?
  # TODO this dispatches and checks that the first arg is a Type, so it has a teensy bit of extra
  #      overhead compared to a plain old function, which is potentially problematic since new is
  #      called anytime you create any Nulan object (but not literals like [] and {})
  # TODO this isn't called when using literals like [] and {} ?
  (generic new -> (isa Type x) @args
    (external/new x @args))


  # TODO how to implement primitive types (null, numbers, strings) efficiently ?
  #(type Void)

  #(def void? -> x
  #  (isa? x Void))

  (external/type Error = Error message)

  (def error -> x
    (external/throw (new Error x)))



  # This is all basically Promise stuff, but I prefer the name Delay rather than
  # Promise.
  #
  # Delays/Promises/Futures/whatever you want to call them provide an interesting
  # way of explicitly dealing with asynchronous stuff in your program.
  #
  # The basic idea is, if you gotta do something asynchronous, like read a file or
  # whatever, normally you would have a callback function that is called when the
  # operation is completed.
  #
  # Instead, it's a lot nicer if you return a Delay, which is an object that
  # represents a value that isn't ready right now, but will be ready in the future.
  #
  # You can then call wait on the Delay, which will return a new Delay that
  # calls the function when the input Delay is complete:
  #
  #   # wait until the read-file function completes, then do stuff with the file
  #   (wait (read-file "foo") -> file
  #     ...)
  #
  # Wait a sec, how is this any better than passing a callback argument to the
  # read-file function? Well, honestly, it isn't. But! We can do other nifty
  # things with Delay that you can't do with callbacks.
  #
  # For instance, since Delays are first class values, you can store them in
  # variables or map over them:
  #
  #   (var files = (map ["foo" "bar" "qux"] read-file))
  #
  # The above will read the files "foo", "bar", and "qux" *in parallel*. To get
  # the completed values, you can use wait/each, wait/map, wait/keep, or
  # wait/fold:
  #
  #   # do something for each file
  #   (wait/each files -> file
  #     ...)
  #
  # The various wait/ functions work incrementally: they don't wait for all the
  # Delays to complete. But they still maintain the order of the list.
  #
  # Trying to do all that with standard Node.js callbacks is a huuuuuuuuuge pain
  # in the butt, which is why you have libraries like Async.js
  #
  # So, Delays let you write async code which is simple and clear and powerful...
  # *without* needing to use callbacks or Async.js
  #
  # Oh yeah, and there's a >> macro which makes it easy to chain Delays:
  #
  #   # read the file "foo"
  #   # then convert it to JSON
  #   # then map over the JSON, reading a file for each element in the JSON array
  #   (>> (read-file "foo")
  #       (->json %)
  #       (map % read-file))
  #
  # Inside the >> macro, you can use % to refer to the value of the previous Delay
  # in the chain.
  #
  # Despite all that, I'm not a fan of Delays, because certain async things are
  # still clunky to write with Delays. But they are now built-in to ECMAScript 6,
  # and various JavaScript APIs (including built-ins!) will be returning
  # promises in the near future, so Nulan has to cope with that.
  #
  # TODO built-in Promises don't have an initializer property
  (external/type Delay = Promise initializer)

  # Waits for a delayed value to complete, then calls the function
  # If the function returns a delayed value, it will wait for that to finish before completing
  # Returns a new delayed value, so it is composable
  (generic wait -> (isa Delay x) f
    (x.then f))

  # Lets you convert an asynchronous thing into a Delay, like so:
  #
  #   (def delay/for -> x i
  #     (delay -> done error
  #       (setTimeout (-> (done x)) i)))
  #
  #   (def timeout -> i
  #     (delay -> done error
  #       (setTimeout (-> (error "timeout")) i)))
  #
  #   # Returns a delayed value which will be 5 after 1000 milliseconds
  #   (delay/for 5 1000)
  #
  #   # Returns a delayed value which will throw an error after 1000 milliseconds
  #   # Useful if you want to abort an asynchonous call after a set amount of time
  #   (timeout 1000)
  #
  (def delay -> f
    (new Delay -> done error
      (f done (-> x (error (new Error x))))))

  # If the value is already a Delay, it returns it as-is
  # Otherwise, it delays the value for essentially 0ms
  # Useful if you want to pass a value to wait
  # TODO shouldn't this be generic ?
  (def delay/value -> x
    (Delay.resolve x))

  # Shows how to wrap a Node.js function to return a Delay
  # TODO should use Promise.promisify or something instead ?
  (def read-file -> path
    (delay -> done error
      ((require "fs").readFile path { encoding = "utf8" } -> err file
        (if err
          (error err)
          (done file)))))

  # TODO this shouldn't rely upon the fact that push mutates
  (def get-all-files -> path
    (let r = []
      (loop s = path
        (wait (get-files s) -> files
          (each files -> x
            # TODO I think this can cause the list to be out-of-order
            (wait (file? x) -> f?
              (if f?
                (push r x)
                (wait (dir? x) -> d?
                  (if d?
                    (loop x)
                    (error "expected file or directory"))))))))
      r))



  # This creates a new type for hash tables rather than reusing JavaScript's Object.
  #
  # This is because I prefer disjoint types: arrays and hash tables are different,
  # and serve different purposes, so functions defined on one should not work on the
  # other.
  #
  # So by using a new type, I ensure that calling list functions on a hash table
  # throws an error, and calling hash table functions on a list throws an error.
  #
  # In addition, this allows me to safely extend Hash without mucking up
  # Object.prototype. Though... that's actually a moot point, since extending Any
  # already mucks up Object.prototype. Oh well.
  #
  # TODO how much slower is this than using plain JS objects ?
  # TODO open problem: should {} expand to (new Hash) ? Obviously yes, but how much slower is it ?
  (type Hash)

  (generic has? -> (isa Hash x) key
    (external/has? x key))

  (generic get -> (isa Hash x) key (opt f)
    (if (has? x key)
          (external/get x key)
        # TODO can we handle optional args better ?
        (void? f)
          (error "the key @key is not in the hash table")
        (f)))

  # TODO what about saying (<= (get hash key) value) ?
  (generic set -> (isa Hash x) key value
    (do (<= (external/get x key) value)
        x))



  # Functional iterators

  # See (extend traverse -> (isa Array x) ...) below for an example implementation
  #
  # These are actually lazy cons cells in disguise, shhh, don't tell anybody!
  #
  # Though they might be cons cells, the names have been intentionally changed
  # so people don't start using them as cons cells.
  #
  # These should be used *only* to traverse a list.
  #
  # If people start treating these like cons cells, we'll end up with functions
  # like map returning Step/Done. I don't want that. The only function that
  # should return Step or Done is the generic function traverse.
  #
  # I'm fine with having actual cons cells, but they should be called cons cells,
  # and they would have to extend the traverse generic just like any other list.
  #
  (type Done)

  (type Step value next)

  (def done? -> x
    (isa? x Done))

  (def step -> value next
    (new Step value next))

  (def done ->
    (new Done))

  (generic next -> (isa Step x)
    (x.next))

  (generic value -> (isa Step x)
    x.value)

  (generic traverse)



  # Hypothetical cons implementation. I don't plan to actually use this, but
  # it does demonstrate the distinct similarities between Step/Done and Cons/Nil
  #
  # It's also a decent demonstration of how easy it is to define new data types in Nulan.
  #
  # Note that cons cells extend some stuff that Step/Done don't, because they need to
  # be usable in things like map/keep/foldl/etc
  #
  (type Nil @Done)
  (type Cons @Step)

  # nil is a singleton value used to represent the empty list
  (var nil = (new Nil))

  (extend empty -> (isa Cons x)
    nil)

  # TODO should maybe return x instead ?
  # TODO maybe it should be an error to call empty on nil ?
  (extend empty -> (isa Nil x)
    nil)

  # TODO I don't think this is correct... the list will be in reverse order!
  (extend push -> (isa Cons x) y
    (cons y x))

  # It would be trivial to make cons lazy like Step, but I decided to go for a normal strict version
  (def cons -> x y
    (new Cons x y))

  # Other types may want to use car/cdr too, so they're generic rather than normal functions
  (generic car -> (isa Cons x)
    x.value)

  (generic cdr -> (isa Cons x)
    x.next)

  # Names shamelessly taken from Arc
  # Fun fact: with Nulan's type dispatch system, trying to call
  #           scar/scdr on nil is automatically a type error!
  # TODO (<= (car x) value) should work
  # TODO (<= (cdr x) value) should work
  (generic scar -> (isa Cons x) v
    (<= x.value v))

  (generic scdr -> (isa Cons x) v
    (<= x.next v))

  # This is the same behavior as Common Lisp and Arc: calling car/cdr on nil returns nil
  # You can remove these to get the Scheme behavior where calling car/cdr on nil throws an error
  (extend car -> (isa Nil x)
    x)

  (extend cdr -> (isa Nil x)
    x)

  # Make it work as a traversable, so all the list goodies automatically work on it
  (extend next -> (isa Cons x)
    (cdr x))

  (extend traverse -> (isa Cons x)
    x)



  # Generic functions for lists

  # You only need to extend traverse to get traversal (foldl, some, every, etc)
  # If you also extend push and empty, then you get all kinds of things for free,
  # like map/zip/filter/len/etc
  (generic empty)    # should return an empty version of the list
  (generic push)     # should add a new item to the list and return the list

  # Look at all these lovely functions that you get for free if you extend traverse/empty/push

  # If you extend traverse you get len for free, but some lists have a faster
  # (usually constant time) length function, which is why you can extend len
  (generic len -> x
    # Call recur inside loop to recurse
    (loop y = (traverse x)
          i = 0
      (if (done? y)
        i
        (recur (next y)
               (+ i 1)))))

  (def foldl -> x init f
    (loop v = init
          t = (traverse x)
      (if (done? t)
        v
        (recur (f v (value t))
               (next t)))))

  # The functions with the wait/ prefix are the same as the unprefixed versions, except they
  # wait for the lists' elements before proceeding, so they maintain the order of the list
  # even when the lists' elements are delayed
  #
  # Very useful for asynchronous stuff!
  #
  (def wait/foldl -> x init f
    (foldl x (delay/value init) -> out in
      (wait out -> out2
        (wait in -> in2
          (f out2 in2)))))

  # The actual implementations of map/each/keep, defined using foldl
  (def foldl/map -> foldl x f
    (foldl x (empty x) -> out in
      (push out (f in))))

  (def foldl/each -> foldl x f
    (foldl x (void) -> out in
      (do (f in)
          out)))

  (def foldl/keep -> foldl x f
    (foldl x (empty x) -> out in
      (if (f in)
        (push out in)
        out)))

  # Now you see why I implemented the foldl/ versions
  (def map -> x f
    (foldl/map foldl x f))

  (def each -> x f
    (foldl/each foldl x f))

  (def keep -> x f
    (foldl/keep foldl x f))

  (def some -> x f
    (foldl/some foldl x f))

  (def wait/map -> x f
    (foldl/map wait/foldl x f))

  (def wait/each -> x f
    (foldl/each wait/foldl x f))

  (def wait/keep -> x f
    (foldl/keep wait/foldl x f))

  (def wait/all -> x
    (wait/map x -> v v))


  # The only function that can't be defined in terms of foldl :(
  (def some -> x f
    (loop t = (traverse x)
      (if (done? t)
            false
          (f (value t))
            true
          (recur (next t)))))

  (def every -> x f
    (not (some x -> y (not (f y)))))

  # If the lists after the first are larger than the first array, they are truncated
  # If the lists after the first are smaller than the first array, an error is thrown
  # TODO maybe should return (void) if the lists are too small, rather than throw an error ?
  (def zip -> x @args
    (loop y = (traverse x)
          a = (map traverse args)
          r = (empty x)
      (if (done? y)
        r
        (recur (next y)
               (map a next)
               (push r (map a value))))))

  # Super useful if you want to map over multiple lists simultaneously, like so:
  #
  #   (mapzip [1 2 3] [4 5 6] -> x y
  #     (log x y))
  #   1 4
  #   2 5
  #   3 6
  #
  (def mapzip -> @a f
    (map (zip @a) -> x
      (f @x)))


  # TODO this macro doesn't work due to duplicate variables being invalid in Nulan
  ($mac >> -> x @args
    (w/sym %
      (foldl args x -> out in
        `(wait out -> % in))))


  # Uses native JavaScript arrays for Raah Speehd!!!1!
  (external/type Array = Array length)

  # Getting an array's length is constant time
  (extend len -> (isa Array x)
    x.length)

  (extend empty -> (isa Array x)
    [])

  # This implementation of push is generic: it will work on anything that has a length property
  # regardless of whether it's a true array or not. In fact, it basically just copies the official
  # Array.prototype.push from the ECMAScript spec.
  #
  # Nulan's type system prevents it from being used on things other than Arrays, though, unless you
  # extend it, so it's still safe.
  #
  # Implementing it in Nulan rather than deferring to the native version potentially has a speed penalty,
  # but it allows it to work even if len is extended.
  (extend push -> (isa Array x) y
    (let l = (len x)
      (do (<= (external/get x l) y)
          (<= x.length (+ l 1))
          x)))

  # TODO implement this generically for all traversables ?
  #      probably not: nth implies fast random access, which most traversables lack
  # TODO should probably be able to say (<= (nth array index) value)
  (generic nth -> (isa Array x) i
    (if (and (>eq i 0)
             (< i (len x)))
      (external/get x i)
      (error "invalid index")))

  (extend traverse -> (isa Array x)
    (let l = (len x)
      (loop i = 0
        (if (< i l)
          # Note that the second argument to step is a thunk that when called will continue the traversal
          (step (nth x i)
                (-> (recur (+ i 1))))
          (done)))))

  # TODO implement this generically for all traversables ?
  #      probably not: last implies fast access to the last element, which most traversables lack
  (generic last -> (isa Array x)
    (let l = (len x)
      (if (> l 0)
        (nth x (- l 1))
        (error "array does not have any elements"))))



  # Whee event listeners
  (type Event listeners)

  (def event ->
    (new Event []))

  # TODO I don't think push is the right name for this operator
  (extend push -> (isa Event x) v
    (do (each x.listeners -> f
          (f v))
        x))

  # Named to be similar to JavaScript event listeners, e.g. (on click -> ...)
  (generic on -> (isa Event x) f
    # TODO shouldn't rely upon the fact that push mutates
    (do (push x.listeners f)
        (void)))


  # Signal is an Event that has a current value
  (type Signal value @Event)

  (def signal -> value
    (new Signal value []))

  # TODO All this stuff was an attempt to treat Signals as lists
  #      but I don't think that's a good idea anymore, so I'm going to be rewriting
  #      all this stuff
  (extend empty -> (isa Signal x)
    (signal (void)))

  (extend last -> (isa Signal x)
    x.value)

  (extend push -> (isa Signal x) v
    (do (<= x.value v)
        (push (isa Event x) v)))

  (extend zip -> (isa Signal x) @args
    (let a = [x @args]
         s = (signal (map a last))
         f = (-> (push s (map a last)))
      (do (each a -> y
            (on y f))
          s)))

  # TODO incorrect implementation of foldl
  (extend foldl -> (isa Signal x) init f
    (let s = (signal init)
      (do (on x -> v
            (push s (f (last s) v)))
          s)))

  (extend map -> (isa Signal x) f
    (let s = (signal (f (last x)))
      (do (on x -> v
            (push s (f v)))
          s)))

  # TODO correct implementation, but now it doesn't work with map, keep, etc
  (extend foldl -> (isa Signal x) init f
    (let s = (signal (f init (last x)))
      (do (on x -> v
            (push s (f (last s) v)))
          s)))



  # This actually has nothing to do with Nulan core, but I was
  # experimenting with how to implement Tab Organizer stuff in Nulan
  (type Opt name @Signal)

  (extend push -> (isa Opt x) v
    (if (isnt x.value v)
      (do (send-message "option-changed" x.name v)
          (push (isa Signal x) v))
      x))

  (var cache = {})

  (var defaults = {})

  (def opt -> x
    (get cache x ->
      (set cache x (new Opt x
                     (get (db/open "user.options") x ->
                       (get defaults x))
                     []))))
