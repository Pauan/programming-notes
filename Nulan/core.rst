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

  ($var in)

  ($mac for -> expr `(in name list)
    `(map list -> name expr))

  ($syntax! in  (right-infix 50))
  ($syntax! for (right-infix 50))


  (for (+ x 2) (in x [1 2 3]))

  (use/syntax { for in } = "path/to/comprehension.nul")

  ((+ x 2) for x in [1 2 3])



  # Magical built-in type
  (type Lazy (matches Function))


  # Everything is implicitly a subset of Any
  (type Any -> _
    true)

  # Using JavaScript's implementation of stuff
  (type Function -> x
    (is (external/typeof x) "function"))

  (type Boolean -> x
    (is (external/class x) "[object Boolean]"))

  (type Number -> x
    (is (external/class x) "[object Number]"))

  (type Array -> x
    (is (external/class x) "[object Array]"))

  (type String -> x
    (is (external/class x) "[object String]"))

  (type Hash-Table -> x
    (is (external/class x) "[object Object]"))

  (type Void -> x
    (is (external/class x) "[object Undefined]"))


  # Numeric types
  (type Negative -> (isa Number x)
    (< x 0))

  (type Positive -> (isa Number x)
    (>is x 0))

  (type Integer -> (isa Number x)
    ((external Number).isInteger x))

  (type Percent -> (isa Positive x)
    (<is x 100))

  (type Degree -> (isa Positive x)
    (< x 360))


  (def void ->
    (external/void 0))

  (def void? -> x
    (isa? Void x))


  function Wrapper(types, value) {
    this.types = types
    this.value = value
  }

  function check(types, x) {
    types.forEach(function (f) {
      if (!f.__predicate__(x)) {
        throw new TypeError("contract failed")
      }
    })
  }
  
  function dedupe() {
    var a = []
    for (var i = 0; i < arguments.length; ++i) {
      arguments[i].forEach(function (x) {
        if (a.indexOf(x) === -1) {
          a.push(x)
        }
      })
    }
    return a
  }

  function Type(types, predicate) {
    function f(x) {
      if (x instanceof Wrapper) {
        check(f.__types__, x.value)
        return new Wrapper(dedupe(x.types, f.__types__), x.value)
      } else {
        check(f.__types__, x)
        return new Wrapper(f.__types__, x)
      }
    }
    f.__predicate__ = predicate
    f.__types__ = types.reduce(function (x, y) {
      return dedupe(x, y.__types__)
    }, [f])
    return f
  }
  
  function coerce(f, x) {
    if (x instanceof Wrapper) {
      check(f.__types__, x.value)
      return new Wrapper(f.__types__, x.value)
    } else {
      check(f.__types__, x)
      return new Wrapper(f.__types__, x)
    }
  }
  
  var Number = Type([], function (x) {
    return typeof x === "number"
  })
  
  var Positive = Type([Number], function (x) {
    return x > 0
  })
  
  var Integer = Type([Number], function (x) {
    return Math.round(x) === x
  })
  
  var PositiveInteger = Type([Positive, Integer], function (x) {
    return true
  })
  
  Positive(Integer(5))
  Integer(Positive(5))
  PositiveInteger(5)
  coerce(Number, PositiveInteger(5))


  if (match(predicate) && supersets.every(match)) {
    ...
  } else if (subsets.some(match)) {
    throw new Error("is not a superset")
  } else {
    throw new Error("did not match")
  }


  (Positive (Integer 5))
  (coerce Positive (Integer 5))


  (type Foo (superset String Number Function) (subset Bar) -> x
    false)

  (type String (subset Foo) ->
    ...)


  (type Foo [Number Number])

  (def foo -> (Foo [a b])
    (+ a b))

  (foo (Foo [1 2]))


  (type Ellipse width height)

  (type Ellipse { width height })

  (type Ellipse { (Positive (Integer width))
                  (Positive (Integer height)) })

  (type Ellipse
    (Positive (Number width))
    (Positive (Number height)))

  (type Ellipse :dict
    (Positive:Number width)
    (Positive:Number height))

  (type Ellipse *
    (Positive:Number width)
    (Positive:Number height))

  (type Ellipse
    :dict (Positive:Number width)
          (Positive:Number height))

  (type Ellipse
    (dict (Positive (Number width))
          (Positive (Number height))))

  (type Ellipse
    @(Positive (Number width))
    @(Positive (Number height)))

  (type Ellipse {
    (Positive (Number width))
    (Positive (Number height))
  })

  (type Ellipse {
    (Positive (Number width))
    (Positive (Number height)) })

  (type Ellipse
    { (Positive (Number width))
      (Positive (Number height)) })

  (type Ellipse
    { width  = (Positive Number)
      height = (Positive Number) })

  (type Ellipse
    { width  = (^ Positive Number)
      height = (^ Positive Number) })

  (type Ellipse
    { width  = (and Positive Number)
      height = (and Positive Number) })

  (type Ellipse
    { width  = (new Number (matches Positive))
      height = (new Number (matches Positive)) })

  (type Ellipse
    { (isa width Positive Number)
      (isa height Positive Number) })

  (type Ellipse
    { (isa Positive Number width)
      (isa Positive Number height) })

  (type Ellipse
    (isa Positive Number width)
    (isa Positive Number height))

  (type Ellipse ->
    { width  = (isa _ Positive Number)
      height = (isa _ Positive Number) }
    true)

  (type Ellipse
    { width  = (isa Positive Number)
      height = (isa Positive Number) })

  (type Ellipse
    { width  = (subset Positive Number)
      height = (subset Positive Number) })

  (type Ellipse
    { width  = (intersect Positive Number)
      height = (intersect Positive Number) })

  (type Ellipse
    { width  = (Positive (Number _))
      height = (Positive (Number _)) })

  (type Ellipse
    { width  = Positive:Number
      height = Positive:Number })

  (def foo -> (Positive:Number x)
    ...)

  (w/dict
    (var width = 5)
    (var height = 10))

  (dict width  = 5
        height = 10)

  (type Ellipse -> x
    (and (object? x)
         (matches? x.width  Number)
         (matches? x.height Number)))

  (type Ellipse -> x
    (matches? x { width  = Number
                  height = Number }))


  (type Ellipse
    { width  = (isa Positive)
      height = (isa Positive) })

  (type Circle -> (isa Ellipse { width height })
    (is width height))


  (extend empty -> (isa String x)
    (new x ""))

  (extend push -> (isa String x) (isa String y)
    (new x (external/+ (external/unwrap x) (external/unwrap y))))

  (extend traverse -> (isa String x)
    (traverse (isa Array x)))


  (Ellipse { width height })

  (Ellipse * width height)
  
  (Ellipse * width = 1 height = 2)

  { width = 1 height = 2 }

  (Ellipse:dict width height)

  (Ellipse:dict width  = 5
                height = 10)

  (Ellipse { width = 5 height = 10 })

  (Circle { width = 5 height = 5 })

  (Circle (Ellipse { width = 5 height = 5 }))


  (type PositiveInteger (subset Positive Integer))


  (Positive (Integer 5))
  (Integer (Positive 5))
  
        Number
       /      \
  Positive  Integer
       \      /
    PositiveInteger


  (type Hsla
    { hue        = (matches Degree)
      saturation = (matches Percent)
      lightness  = (matches Percent)
      alpha      = (matches Percent) })

  (def hsl -> hue saturation lightness (opt alpha = 100)
    (new Hsla { hue saturation lightness alpha }))

  (generic ->css -> (new Hsla { hue saturation lightness alpha })
    "hsla(@{hue}, @{saturation}%, @{lightness}%, @{/ alpha 100})")


  (type Beak
    { length = (Positive Number) })

  (type Bird
    { beak = Beak })

  (type Bird
    { wings = { length = positive-number? }
      beak  = { length = positive-number? }
      legs  = { length = positive-number? }
      eyes  = { color = hsla? } })

  (type Sparrow (subset Bird)
    { wings = { length = 50 }
      eyes  = { color = (hsla 50 50 50 100) } })



  (type Event
    { listeners = Array })

  (type Signal (inherit Event)
    { value = Any })

  (def signal -> value
    (Signal { value listeners = [] }))



  (type event?
    { listeners = array? })

  (type signal? (inherit event?)
    { value = any? })

  (def signal -> value
    { value listeners = [] })



  (new ellipse? { width  = 5
                  height = 10 })


  (type Meter { value })
  
  (def meter -> value
    (new Meter { value }))


  (type meter?
    { unit  = (is unit "meter")
      value = (number? value) })

  { value = value }

  { (number? value) = (number? value) }

  (def meter -> value
    (new meter? { value }))



  (type void -> x
    (empty x))

  (type kilometer?
    { unit  = "kilometer"
      value = number? })

  (type ellipse?
    { width  = positive-number?
      height = positive-number? })

  (type circle? (subset ellipse?) -> { width height }
    (is width height))


  (type car? (superset vehicle?) -> x
    (matches x { width  = number?
                 height = number? }))

  (type ellipse? (extends circle?)
    { width  = number?
      height = number? })

  (type vehicle?)

  (type car? (extends vehicle?)
    { price wheel body doors axel })

  (contract expensive-car? (sub car?) -> { price }
    (> price 50000))

  (contract circle? (restricts ellipse?) -> { width height }
    (is width height))

  (contract <is -> x y
    (<is x y))

  (contract >is -> x y
    (>is x y))

  (contract is @<is @>is -> x y
    (is x y))

  (contract >length? @>is @Array -> x y
    (>is x.length y))

  (contract length? @>length? -> x y
    (is x.length y))

  (match x
    [a b c]       => [c b a]
    (positive? a) => a
    1             => 2
    5             => 6)

  (length? [a b c] 3)
  (>length? [a b c] 3)

  (is u.length 3)
  (>is u.length 3)

  # Mutable dictionary/hash table
  (type Hash-Table)

  (matches Integer x y)

  (new Hash-Table)

  (new Array { length = 0 })

  # Unlike JavaScript strings, a Character is a proper Unicode code point
  (type Character { codepoint = positive-integer? })

  # Mutable resizable vectors that can contain anything
  (type Array { length = positive-integer? })

  # Strings are a subset of arrays that can only contain Characters
  (type String @Array)

  # Void basically means "lack of meaningful value"
  (type Void)

  (type Error { message = String })


  (var true  = (Boolean { value = (external true) })
       false = (Boolean { value = (external false) }))

  (extend empty -> (String)
    (String { length = 0 }))

  (def void ->
    (Void))

  # TODO should this be generic ?
  (def void? -> x
    (or (external/null? x)
        (isa? x Void)))

  (def error -> message
    (let e = (Error { message })
      (do ((external Error).captureStackTrace e error)
          (external/throw e))))


  (var [a b c @d] = [1 2 3 4 5 6])

  (var u = [1 2 3 4 5 6]
       a = (nth u 0)
       b = (nth u 1)
       c = (nth u 2)
       d = (slice u 3))

  (do (var u1 = [1 2 3 4 5 6])
      (var u2 = (traverse u1))
      (if (done? u2)
        (error "expected at least 3 elements but got 1"))
      (var a = (value u2))
      (var u3 = (next u2))
      (if (done? u3)
        (error "expected at least 3 elements but got 2"))
      (var b = (value u3))
      (var u4 = (next u3))
      (if (done? u4)
        (error "expected at least 3 elements but got 3"))
      (var c = (value u4))
      (var u5 = (next u4))
      (var d = (into (empty u1) u5))) # TODO into isn't quite the right function for this

  (def ->array -> x
    (if (external/array? x)
      x
      (into [] x)))

  (def into-array -> x y
    (if (external/array? x)
      y
      (into (empty x) y)))

  (def expect-length -> x min rest
    (let l = x.length
      (if (< l min)
        (if rest
          (error "expected at least @min elements but got @l")
          (error "expected exactly @min elements but got @l")))))

  # TODO not correct
  (def destructure-array -> x min rest
    (loop t = (traverse x)
          i = 0
          r = []
      (if (done? t)
            (if (< i min)
              (if rest
                (error "expected at least @min elements but got @i")
                (error "expected exactly @min elements but got @i"))
              r)
          (and (not rest)
               (> i min))
            (error "expected exactly @min elements but got @i")
          (recur (next t)
                 (+ i 1)
                 (push r (value t))))))


  (var [a b c @d] = [1 2 3 4 5 6])

  var u1 = [1, 2, 3, 4, 5, 6]
  var u2 = toArray(u1)
  expectLength(u2, 3, true)
  var [a, b, c, ...u3] = u2
  var d = intoArray(u1, u3)
  
  var [a, b, c, d] = destructureArray([1, 2, 3, 4, 5, 6], 3, true)


  (var [a b c @d e] = [1 2 3 4 5 6])

  var u1 = [1, 2, 3, 4, 5, 6]
  var u2 = toArray(u1)
  expectLength(u2.length, 4, true)
  var [a, b, c, ...u3] = u2
  var d = intoArray(u1, u3.slice(0, -1))
  var e = u3[u3.length - 1]



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

  (type Step { value = Any
               next  = Function })

  (type Step Done)

  (generic done? -> (Done)
    true)

  (def step -> value next
    (Step { value next }))

  (def done ->
    (Done))

  (type Type { parent     = Type
               properties = Hash })

  (Step (Step { value = 1 next = 2 }))

  (generic next -> (Step { next })
    (next))

  (generic value -> (Step { value })
    value)


  (generic next -> (Step x)
    (x.next))

  (generic value -> (Step x)
    x.value)


  (generic traverse)


  # Generic functions for lists

  # You only need to extend traverse to get traversal (each/foldl/some/every/len/etc)
  #
  # If you also extend push and empty, then you get all kinds of things for free,
  # including but not limited to map/zip/keep
  #
  (generic empty)  # should return an empty version of the list
  (generic push)   # should add a new item to the list and return the list

  (def foldl -> x init f
    # Call recur inside loop to recurse
    (loop v = init
          t = (traverse x)
      (if (done? t)
        v
        (recur (f v (value t))
               (next t)))))

  # If you extend traverse you get len for free, but some lists have a faster
  # (usually constant time) length function, which is why you can extend len
  (generic len -> x
    (foldl x 0 -> sum _
      (+ sum 1)))

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

  # Takes the elements of the second list and pushes them into the first list
  (def into -> x y
    (foldl y x -> out in
      (push out in)))

  # This is generic so that it can work on non-traversable things, and also so it can
  # be more efficient if called on an immutable list
  (generic copy -> x
    (into (empty x) x))

  # TODO implement wait/concat as well ?
  (def concat -> x @args
    # copy is needed because arrays are mutable
    (foldl args (copy x) -> out in
      (foldl in out -> out2 in2
        (push out2 in2))))



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

  (generic keys -> (isa Hash x)
    (external/keys x))

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

  # A bit faster than using the default len, though still O(n) time
  (extend len -> (isa Hash x)
    (len (keys x)))

  (extend empty -> (isa Hash x)
    {})

  (extend push -> (isa Hash x) [key value]
    (set x key value))

  # TODO this isn't lazy, but the only way to make it lazy is to use ES6 generators...
  (extend traverse -> (isa Hash x)
    (traverse (map (keys x) -> key [key (get x key)])))



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

  # It would be trivial to make cons lazy like Step, but I decided to go for a normal strict version
  (def cons -> x y
    (new Cons x y))

  # Other types may want to use car/cdr too, so they're generic rather than normal functions
  (generic car -> (isa Cons x)
    x.value)

  (generic cdr -> (isa Cons x)
    x.next)

  # This is the same behavior as Common Lisp and Arc: calling car/cdr on nil returns nil
  # You can remove these to get the Scheme behavior where calling car/cdr on nil throws an error
  (extend car -> (isa Nil x)
    x)

  (extend cdr -> (isa Nil x)
    x)

  # Names shamelessly taken from Arc
  # Fun fact: with Nulan's type dispatch system, trying to call
  #           scar/scdr on nil is automatically a type error!
  # TODO (<= (car x) value) should work
  # TODO (<= (cdr x) value) should work
  (generic scar -> (isa Cons x) v
    (<= x.value v))

  (generic scdr -> (isa Cons x) v
    (<= x.next v))

  # Make it work as a traversable, so all the list goodies automatically work on it
  (extend empty -> (isa Cons x)
    nil)

  # TODO maybe it should be an error to call empty on nil ?
  (extend empty -> (isa Nil x)
    x)

  # TODO I don't think this is correct... the list will be in reverse order!
  (extend push -> (isa Cons x) y
    (cons y x))

  # We don't need to extend value, because Cons inherits from Step, and the implementation
  # of value is the same for both Cons and Step
  #
  # We *do* need to extend next, because Step is lazy but Cons is strict
  (extend next -> (isa Cons x)
    (cdr x))

  # TODO If traverse traversed the cons in reverse order, then push would work but then
  #      it would break the invariant that map/each/etc work from left-to-right...
  (extend traverse -> (isa Cons x)
    x)



  # TODO this macro doesn't work due to duplicate variables being invalid in Nulan
  ($mac >> -> x @args
    (w/sym %
      (foldl args x -> out in
        ~(wait out -> % in))))

  ($mac ++ -> x
    `(<= x (+ x 1)))



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



  ($def pattern-array-required -> a
    (keep a -> x (not (matches? x `@_))))

  ($generic pattern-sort -> x y
        # deep equality
    (if (pattern/is x y)
      "same"
      "disjoint"))

  ($extend pattern-sort -> `[@args1] `[@args2]
    (if (is (len (pattern-array-required args1))
            (len (pattern-array-required args2)))
      (let len1 = (len args1)
           len2 = (len args2)
        (if (is len1 len2)
              "same"
            (< len1 len2)
              "subset"
            "superset"))
      "disjoint"))

  ($extend pattern-sort -> `(opt _ _) `(opt _ _)
    "same")

  ($extend pattern-sort -> _ `(opt _ _)
    "subset")

  ($extend pattern-sort -> `(opt _ _) _
    "superset")


  (def foo -> x x)
  (def foo -> (opt x 5) x)


  (def isa -> x type
    (external/instanceof x type))

  ($extend pattern-sort -> `(isa x1 type1) `(isa x2 type2)
    (if (is x1.prototype x2.prototype)
          "same"
        (isa x1.prototype x2)
          "subset"
        (isa x2.prototype x1)
          "superset"
        "disjoint"))

  (def foo -> (isa x Foo)
    ...)