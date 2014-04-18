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

  (external/type Any = Object)

  # everything implicitly inherits from Any
  # TODO check if having types actually inherit from Type is slow
  (type Type)

  # TODO can't use because although JavaScript allows any function to be a constructor, I want Nulan to be a bit more restrictive
  #(external/type Type = Function)

  # TODO how good is using splice with external/new ?
  (generic new -> (isa Type x) @args
    (external/new x @args))


  # TODO how to implement primitive types (null, numbers, strings) efficiently ?
  #(type Void)

  #(def void? -> x
  #  (isa? x Void))



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
  # See (extend traverse -> (isa Array x)) below for an example implementation
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

  (generic traverse -> (isa Step x)
    x)



  # Generic functions for lists

  # You only need to extend traverse to get traversal (foldl, some, every, etc)
  # If you also extend push and empty, then you get all kinds of
  # things for free, like map/zip/filter/len/etc
  (generic traverse) # should return step/done to traverse the list
  (generic empty)    # should return an empty version of the list
  (generic push)     # should add a new item to the list and return the list

  # If you extend traverse you get len for free, but some lists have a faster
  # (usually constant time) length function, which is why you can extend len
  (generic len -> x
    (loop y = (traverse x)
          i = 0
      (if (done? y)
        i
        (loop (next y)
              (+ i 1)))))


  # Uses native JavaScript arrays for Raah Speehd!!!1!
  (external/type Array = Array length)

  # Getting an array's length is constant time
  (extend len -> (isa Array x)
    x.length)

  (extend empty -> (isa Array x)
    [])

  # TODO implement this generically for all traversables ?
  #      probably not: nth implies fast random access, which most traversables lack
  (generic nth -> (isa Array x) i
    (if (and (>eq i 0)
             (< i (len x)))
      (external/get x i)
      (error "invalid index")))

  (extend traverse -> (isa Array x)
    (let l = (len x)
      # Use recur inside the loop to recurse
      (loop i = 0
        (if (< i l)
          # Note that the second argument to step is a thunk that when called will continue the traversal
          (step (nth x i)
                (-> (recur (+ i 1))))
          (done)))))

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
  #      probably not: last implies fast access to the last element, which most traversables lack
  (generic last -> (isa Array x)
    (let l = (len x)
      (if (> l 0)
        (nth x (- l 1))
        (error "array does not have any elements"))))



  # Look at all these lovely functions that you get for free if you extend traverse/empty/push
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
          (loop (next t)))))

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
        (loop (next y)
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
