In this tutorial, I will explain what boxes are, why they are useful, and how
to implement them, using `Racket <http://racket-lang.org/>`_. By the end of
this tutorial, you will have created a tiny but fully functional compiler that
uses boxes.

First off, a *box* is a data structure that can hold 1 item. It supports
getting and setting that item. This is very limited compared to a list, which
can hold an unlimited number of items! But as we shall soon see, the humble and
simple box holds surprising amounts of power.

Boxes are useful because they allow you to represent a variable with a
first-class data structure. In other words, it's now possible to create,
inspect, and modify variables from within the language.

This might sound very uninteresting and useless, but by using boxes, you can
easily create module systems which are incredibly fast, powerful, and flexible.
You can also easily make macros 100% hygienic. And it's easier to write
programs that do static analysis (e.g. static type systems).

Let's get started! To run this program, copy-paste the code blocks into a
file (which I will assume is called ``boxes.rkt``), and then run
``racket boxes.rkt``. You don't have to copy-paste all of them at once: you can
do it a little bit at a time, as you read through the tutorial.


Compiler
========

::

  #lang racket/base

  (define (make-box gensym)
    (make-hash (list (cons 'gensym gensym))))

  (define (box? x)
    (hash? x))

The above code is pretty simple: we define a function called ``make-box`` which
takes a gensym. It places that gensym into a mutable hash table with the key
'gensym, and lastly returns the hash table.

We also define a function ``box?`` which can be used to determine whether
something is a box or not.

We could have used Racket's ``struct`` for this, but since we're going to be
adding new features to the boxes later, it's more flexible to use a hash table.
And since boxes only need to be handled at compile time, there's no performance
penalty for using hash tables rather than structs.

::

  (define (box->gensym box)
    (hash-ref box 'gensym))

Later on we will need to convert boxes to gensyms, so that's what this function
does: it simply returns the gensym which is stored with the ``'gensym`` key.

::

  (define (box-macro? box)
    (hash-has-key? box 'macro))

  (define (box-macro box)
    (hash-ref box 'macro))

  (define (box-macro! box f)
    (hash-set! box 'macro f))

A *macro* is simply a function that has been attached to a box with the
``'macro`` key.

In general, attaching information to boxes is a good idea, because boxes work
correctly with modules and scope, whereas symbols do not.

So by attaching macros to boxes, macros will work with modules. This also
allows us to create 100% hygienic macros, which I will discuss later.

::

  (define (make-scope)
    (make-hash))

We now define a *scope*. A scope is simply a mutable hash table. To be more
specific, a scope is a hash table that has *symbols* as keys, and *boxes* as
values.

::

  (define (gensym symbol)
    (string->uninterned-symbol (symbol->string symbol)))

  (define (scope-define! scope name)
    (let ((box (make-box (gensym name))))
      (hash-set! scope name box)
      box))

The above is a helper function that takes a scope and symbol, creates a new
box, places the box into the scope, then returns the box.

This makes it easy to create new boxes in a particular scope.

::

  (define (make-stack)
    (make-parameter null))

We need to use stacks, but Racket doesn't have a built-in data type for stacks.
So instead we'll simulate a stack by using a list.

If our compiler were implemented in a different language, we might use a
mutable array, or an actual stack data type.

We use a `parameter <http://docs.racket-lang.org/reference/parameters.html>`_
because we want to be able to push an item onto the stack temporarily, and then
pop it when we're done.

::

  (define-syntax-rule (with-stack stack x . body)
    (let ((param stack))
      (parameterize ((param (cons x (param)))) . body)))

We define a Racket macro called ``with-stack`` that will push an item onto the
stack, run the body, and then pop it from the stack. This will work correctly
even if body throws an error or uses continuations.

We use this to temporarily push a new scope onto the stack, so that it's
automatically popped when we're done with it.

If our compiler were implemented in a different language, we might use
``try { stack.push(x); body() } finally { stack.pop() }`` which is roughly
equivalent to ``parameterize``.

::

  (define (stack-peek stack)
    (car (stack)))

The ``stack-peek`` function returns the top (most recent) item from the stack.

::

  (define (stack-items stack)
    (stack))

The ``stack-items`` function returns all the items of the stack as a list,
in order from most recent to least recent.

Since stacks are already lists, we don't have to do anything. But if we later
decide to use a different data structure, we only need to change ``stack-items``
and the rest of our code can remain unchanged.

::

  (define scope-chain (make-stack))

Now we define a *chain* of scopes: there's the global scope, and each function
creates its own sub-scope. We represent this as a stack of scopes.

  (define-syntax-rule (with-stack stack value . body)
    (let ((x value))
      (dynamic-wind
        (lambda () (stack-push! stack x))
        (lambda () . body)
        (lambda () (stack-pop! stack)))))

We also define a Racket macro that will push something onto the stack, run the
body, and then pop from the stack. This makes it convenient to temporarily add
something to the stack.

It uses ``dynamic-wind`` to make sure that it always works correctly even if
the body throws an error or uses continuations.

::

  (define (current-scope)
    (stack-peek scope-chain))

It's common to want to get the current scope, so we create this little helper
function.

::

  (define-syntax-rule (with-new-scope . body)
    (with-stack scope-chain (make-scope) . body))

It's also common to want to create a new temporary scope, so that's what this
Racket macro does.

::

  (define (scope-has? name)
    (let loop ((xs (stack-items scope-chain)))
      (if (null? xs)
          #f
          (if (hash-has-key? (car xs) name)
              (car xs)
              (loop (cdr xs))))))

The ``scope-has?`` function takes a symbol and walks through the scope chain from
inner to outer, checking each scope to see if it contains the symbol. If so, it
returns the first scope that matched. If not, it returns ``#f``.

For instance, let's suppose you had the global scope, and then a function
``foo``, and then a function ``bar`` inside the function ``foo``. You would
have three scopes, in this order: ``[bar foo global]``.

The ``scope-has?`` function would first check to see if the symbol exists in the
``bar`` scope. If it does, it returns the ``bar`` scope. If not, it then checks
the ``foo`` scope. It repeats those steps until it has checked all the scopes.

The end result of this is that inner variables can *shadow* outer variables: if
there is a global variable ``qux``, and a function also defines a local
variable ``qux``, then ``scope-has?`` will return the function scope, rather than
the global scope.

::

  (define (symbol->box name)
    (let ((scope (scope-has? name)))
      (if scope
        (hash-ref scope name)
        (raise-syntax-error name "undefined variable" name))))

The ``symbol->box`` function takes a symbol. It checks if the symbol exists in the
scope chain. If the symbol isn't in the scope chain it will throw an "undefined
variable" error.

But if the symbol *does* exist, it returns the *box for that symbol*. Remember,
scopes use symbols as keys, and boxes as values. So in order to convert a
symbol to a box, we walk the scope chain until we find a scope that contains
the symbol, then we return the box for that symbol in *that scope*.

This is important because... consider the situation where you have a global
variable ``qux``, and a function that defines a local variable ``qux``. They
have the same name, but they're actually different variables! So, the scope
chain would look like this: ``[{ qux = #<box> } { qux = #<box> }]``

The left-most scope is the scope for the function, and the right-most scope is
the global scope. They both contain a box for the symbol ``qux``, but the boxes
are actually different. So when we look up the symbol ``qux``, we return the box
for the function scope, rather than the box for the global scope.

::

  (define (->box name)
    (if (symbol? name)
        (symbol->box name)
        name))

This is just a little helper which will convert symbols to boxes, but if it's
not a symbol, it'll just return it unmodified. Having this as a helper function
makes the ``compile-list`` function easier to read.

::

  (define (compile-list expr)
    (let ((f (->box (car expr))))
      (if (and (box? f)
               (box-macro? f))
          (apply (box-macro f) (cdr expr))
          (map compile expr))))

  (define (compile-symbol expr)
    (compile (symbol->box expr)))

  (define (compile-box expr)
    (box->gensym expr))

  (define (compile expr)
    (cond ((pair? expr)
            (compile-list expr))
          ((symbol? expr)
            (compile-symbol expr))
          ((box? expr)
            (compile-box expr))
          (else
            expr)))

Finally we define the compiler. The ``compile-list`` function takes a list,
where the first element is a function or macro, and everything other than the
first element is the arguments to the function/macro.

If the first element is a symbol, it will be converted to a box by using
``->box``. We do this because we need to know whether the symbol is a macro
or not, and that information is stored on *the box itself*.

If the first element is a macro, we just call it.

If the first element is not a macro, then it's a normal function, so we
compile the entire list (including the first element).

The ``compile-symbol`` function first converts the symbol into a box, and then
compiles the box.

The ``compile-box`` function takes a box and returns the gensym for that box.

Lastly, the ``compile`` function will dispatch to the ``compile-`` functions
depending on the type of its argument.

And that's it! Yes, it really is that simple. We now have a full-fledged macro
system that works with scope and modules.

But before we can actually use this, let's define a module system. We will of
course be using boxes a lot, but don't worry, it's all quite simple.

::

  (define (make-module path)
    (make-hash (list (cons 'path path)
                     (cons 'scope (make-scope))
                     (cons 'import-scope (make-scope)))))

First we define the ``make-module`` function, which returns a mutable hash
table that has the following keys: ``'path`` is the unique path to the module,
``'scope`` is the scope for the module, and ``'import-scope`` is a scope for
boxes imported from another module.

::

  (define module-cache (make-hash))

  (define (define-module! name f)
    (hash-ref! module-cache name
      (lambda ()
        (let ((x (make-module name)))
          (f x)
          x))))

We now create a ``module-cache``, which maps module names to modules.

Why do we need this? Well, if you import the same module multiple times, we
want to only compile it once, and return the same module each time. That's what
the cache is for: when you call the ``define-module!`` function, if the module
exists it is just returned, and if it doesn't exist it will create a new
module.

This is also necessary if you want to support mutually recursive modules.

::

  (define module-chain null)

Now we create a stack of modules, which we call ``module-chain``.

::

  (define (current-module)
    (stack-peek module-chain))

We often want to get the current (inner-most) module.

::

  (define (current-module-scope)
    (hash-ref (current-module) 'scope))

  (define (current-module-import-scope)
    (hash-ref (current-module) 'import-scope))

Some helper functions to get the current module's scope and import scope.

::

  (define-syntax-rule (with-module module . body)
    (with-stack module-chain module
      (with-stack scope-chain (current-module-import-scope)
        (with-stack scope-chain (current-module-scope) . body))))

  (define-syntax-rule (with-module/path path . body)
    (with-module (define-module! path (lambda (x) x)) . body))

The above Racket macro will create a new module (if it doesn't already exist),
push that module's import/normal scope onto the scope chain, and then run body.

This makes it much more convenient to add things to a particular module.

::

  (define-syntax-rule (define-macro name args . body)
    (box-macro! (scope-define! (current-scope) 'name)
                (lambda args . body)))

The above Racket macro will create a new box in the current scope, and then
attaches a macro to that box. This makes it easy for us to define new macros.

::

  (with-module/path "std:builtins"
    (define-macro define (name value)
      (let ((box (scope-define! (current-scope) name)))
        `(define ,(compile box) ,(compile value)))))

We're going to add all the built-ins to the ``"std:builtins"`` module.
Normally built-ins (like ``define``, ``set!``, ``lambda``, etc.) are
hard-coded, but with this compiler they can be created as ordinary macros.

The ``define`` macro takes a name and a value. It uses ``current-scope`` to
grab the inner-most scope, then uses ``scope-define!`` to create a new box in
that scope. It returns ordinary Racket code, so it has to manually call
``compile`` to compile the box and value.

::

  (with-module/path "std:builtins"
    (define-macro set! (name value)
      `(set! ,(compile name) ,(compile value))))

The code for the ``set!`` macro is very simple: it just compiles its name and
value and then uses Racket's ``set!``. It will work correctly regardless of
whether ``name`` is a box or a symbol, because the ``compile`` function will
convert symbols to boxes.

::

  (define (compile-lambda-symbol scope x)
    (if (symbol? x)
        (compile (scope-define! scope x))
        (raise-type-error 'compile-lambda-symbol "symbol?" 1 scope x)))

  (define (compile-lambda-args scope args)
    (cond ((null? args)
            null)
          ((pair? args)
            (cons (compile-lambda-symbol scope (car args))
                  (compile-lambda-args scope (cdr args))))
          (else
            (compile-lambda-symbol scope args))))

  (define (compile-lambda scope args body)
    (let* ((args  (compile-lambda-args scope args))
           (body  (compile body)))
      `(lambda ,args ,body)))

  (with-module/path "std:builtins"
    (define-macro lambda (args body)
      (let ((scope (make-scope)))
        (with-stack scope-chain scope
          (compile-lambda scope args body)))))

The ``lambda`` macro is more complex, but still quite managable. First, we
create a new scope using ``make-scope``, and then use ``with-stack`` to push it
onto ``scope-chain``.

The ``compile-lambda`` function simply calls the ``compile-lambda-args``
function and then compiles the body. It's important to note that it uses
``let*`` to guarantee that the args are compiled before the body. This is
because it has to first traverse the args, creating a box for each one, before
it compiles the body, or else we will get an "undefined variable" error.

The ``compile-lambda-args`` function is fairly straight forward. It traverses
the args list, creating a box for each symbol. It only handles normal arguments
and rest arguments, but more functionality could be easily added later.

The ``compile-lambda-symbol`` function creates a new box for the symbol, then
compiles and returns it. Whatever ``compile-lambda-args`` returns is used as
the arguments for the lambda, so we have to return Racket code, which is why
we use ``compile``.

::

  (with-module/path "std:builtins"
    (define-macro begin args
      `(begin ,@(map compile args))))

The ``begin`` macro is very straight forward.

::

  (with-module/path "std:builtins"
    (define-macro with-new-scope args
      (with-new-scope
        `(begin ,@(map compile args)))))

This is a new macro that doesn't exist in Racket. It simply creates a new scope
and compiles its arguments. This lets you create new scopes anytime you want.

But, can't you already do that with ``lambda``? Yes, you can, but the
``with-new-scope`` macro does **all** of its work at compile-time, so it has
absolutely **no** runtime cost *whatsoever*.

If we were compiling to a different language where functions are not optimized
very well (like JavaScript), it would be useful to be able to create new scopes
without the performance cost of creating and calling a function.

Thankfully Racket *does* optimize functions very well, so ``with-new-scope`` is
not that useful in this particular circumstance. It is included here as a
demonstration of the power of boxes.

::

  (with-module/path "std:builtins"
    (define-macro % (x) x))

This interesting little macro lets you bypass the compiler and execute Racket
code directly. This is super useful! It means you can call Racket functions and
use Racket macros from inside our custom language.

Notice how simple it is: it just returns its argument unmodified. It did not
require any changes to our compiler or our macro system.

::

  (define (abspath path base)
    (normal-case-path
      (simplify-path
        (resolve-path
          (path->complete-path (expand-user-path path) base)))))

The ``abspath`` function takes a ``path`` to a file and a ``base`` directory. If
``path`` isn't an absolute path, it will add ``base`` to the front of it, thus
converting it into an absolute path. As an example, ``(abspath "bar" "/foo")``
returns ``"/foo/bar"``.

It correctly handles symbolic links and will normalize the path. We need this
function because we want to allow for all kinds of different ways to import
files: you might import the file ``"./foo"`` or ``"../foo"``, where ``foo`` is
relative to the current file, or you might import it as an absolute path
``"/path/to/foo"``.

So we first convert it into an absolute path so that we can make sure that we
only compile the same file once, even if you import it multiple times.

::

  (define (read-all input)
    (let loop ()
      (let ((x (read input)))
        (if (eof-object? x)
          null
          (cons x (loop))))))

The ``read-all`` function just reads all the S-expressions from a file input
port and returns them as a list. This is used to get the source code of a file,
so we can compile and eval it.

::

  (define module-path (make-parameter (current-directory)))

We use a `parameter <http://docs.racket-lang.org/reference/parameters.html>`_ to
store the current module path. The module path is used to resolve relative
imports.

As an example, if ``module-path`` is ``"/foo"`` and some code tries to import
the file ``"./bar"``, then it will import the file ``"/foo/bar"``.

When compiling a file, we set ``module-path`` to the directory that the file
is in, that way relative imports will always be relative to the current file.

It defaults to the current directory so that code that isn't in a file (like the
REPL) can also use relative imports.

::

  (require racket/path)

We have to require ``racket/path`` because it contains some functions we need
that aren't in ``racket/base``.

::

  (define (import-file file)
    (let ((path (abspath file (module-path))))
      (define-module! (path->string path)
        (lambda (inner)
          (call-with-input-file path
            (lambda (input)
              (parameterize ((module-path (path-only path)))
                (with-module inner
                  (for-each eval (map compile (read-all input)))))))))))

The ``import-file`` function does the actual process of loading a file,
compiling it, and evaluating it.

First, we call ``abspath`` to convert the file to an absolute path. As explained
in the section for ``abspath``, we use this to make sure that, for each file,
we use the same path every time, regardless of whether you import the file
relatively or not.

Next we use ``define-module!``, which as explained earlier will create a new
module if it doesn't exist, or will return the existing module if it does exist.
This is to make sure we only compile and evaluate a file a single time, even if
it's imported multiple times. This also allows for mutually recursive functions
between modules.

We use ``call-with-input-file`` to load the file, which gives us a file input
port.

We use ``parameterize`` to set the ``module-path`` to the directory for the
file, so that relative imports inside the file will be treated as relative to
the file.

We use ``with-module`` to set the module as the current module (this also adds
the module's scopes to the scope chain). Lastly we read the S-expressions from
the file input port, compile all of them, and then evaluate all of them.

::

  (define (relative-path from to)
    (path->string (find-relative-path from to)))

The ``relative-path`` function is the same as ``find-relative-path`` except it
returns a string rather than a path.

It takes two paths and finds the difference between them. As an example,
``(relative-path "/foo/bar/qux" "/foo/bar/corge")`` returns ``"../corge"``,
``(relative-path "/foo/bar/qux" "/foo/bar/qux/corge")`` returns ``"corge"``,
and ``(relative-path "/foo/bar/qux" "/corge")`` returns ``"../../../corge"``.

We use this function to get nicer error messages, so rather than saying
``module /long/path/to/module/foo`` we can instead just say ``module foo``.

::

  (define (import-box-error from to var)
    (let ((from-path  (hash-ref from 'path))
          (to-path    (hash-ref to 'path)))
      (error (format "module ~s already has the variable ~s, so it cannot be imported from the module ~s"
                     (relative-path (current-directory) to-path)
                     var
                     (relative-path (path-only to-path) from-path)))))

The ``import-box-error`` function takes three arguments: the module that we are
importing from, the module we are importing into, and the variable which is
conflicting.

It then throws an error stating that we can't import the variable because it
already exists in the module.

We need this function because... consider the situation where two modules both
define a variable ``foo``, and you then import both of those modules. Without
the ``import-box-error`` function, there would be no error, and the variable
``foo`` would be overwritten by whichever module was imported last.

The problem with this is that you might have some code that imports a library,
and your code works perfectly fine, but then you upgrade the library. The
library added some new variables which conflict with other variables that you're
using, but because it silently overwrote the variables, your code now behaves
incorrectly, but you don't know why: this problem can be tricky to debug.

Or you might have code that imports a library, and everything works fine, but
then you import a second library which silently overwrites the variables from
the first library.

So instead, we simply don't allow for conflicts: if two variables conflict, we
use ``import-box-error`` to throw an error. Now it's clear what's going on, and
it's also clear how to fix the problem. This also gives you confidence: if you
import multiple libraries and you don't get an error, that means it is
*guaranteed* that there are no conflicts.

::

  (define (import-boxes-set hash key value)
    (if (hash-has-key? hash key)
        (error "foo!")
        ;(import-box-error from to key)
        (hash-set! hash key value)))

  (define (import-boxes from to set)
    (let ((scope-to    (hash-ref to 'import-scope))
          (scope-from  (hash-ref from 'scope)))
      (hash-for-each scope-from
        (lambda (key value)
          (set scope-to key value)))))

The ``import-boxes`` function takes a module that we are importing from, a
module that we are importing into, and a function that lets us exclude
importing certain variables.

It will take all of the boxes from the ``from`` scope and place them into the
``to`` import scope, as long as the ``filter`` function returns true.

This is an incredibly simple system. All scopes (global, module, function, etc.)
are represented with hash tables. So all we have to do is grab a box from one
scope and add it to another scope.

Not only is this system very simple, but it can also allow for a great deal of
flexibility: if you expose the current scope chain, and allow for code to
create their own scopes and boxes, then now it's possible for people to write
their own custom module systems that can work fully with the existing module
system.

::

  (define module-prefixes (make-hash))

Thus far, we have only been able to import files. The ``module-prefixes`` hash
table lets us define custom behavior for importing.

You could, for instance, define an ``http:`` prefix, which would allow for
importing a URL, or a ``git:`` prefix which would allow for importing a
Git repository.

The only restriction is that your prefix cannot contain ``:`` and has to end
with ``:``.

It's important to note that the hash table uses ``equal?`` for key comparisons,
because the keys will be strings.

::

  (hash-set! module-prefixes "std:"
    (lambda (prefix file)
      (define-module! file
        (lambda (module)
          (error (format "module ~s does not exist" file))))))

The ``"std:"`` prefix will return the module if it exists, and if not throws
an error.

This is so that you can import ``std:`` modules, like ``"std:builtins"``.

Right now this isn't that useful, since ``"std:builtins"`` is automatically
imported. But later on we can add built-in modules which are optional and have
to be manually imported.

::

  (define module-prefix-re (pregexp "^([^:]+:)(.*)$"))

  (define (import-get-module path)
    (let ((match (regexp-match module-prefix-re path)))
      (if match
        (apply (hash-ref module-prefixes (cadr match)) (cdr match))
        (import-file path))))

We use a regexp called ``module-prefix-re`` to determine whether a module path
contains a prefix or not. It's pretty simple: if it starts with anything other
than ``:`` and has a ``:`` in it, then it's a prefix, otherwise it's a normal
file.

The ``import-get-module`` function takes a module path and checks if it's a
prefix or not. If it is, it calls the prefix function. Otherwise it calls
``import-file`` to compile and evaluate the file.

The only tricky thing here is that ``regexp-match`` returns a list of strings
when it succeeds: the first element of the list is the entirety of the match.
Everything after the first element is the captured groups of the regexp.

We use ``cadr`` to get the first captured group, which is the prefix, so that
we can look it up in ``module-prefixes``. And we don't care about the entirety
of the match, so we use ``cdr`` to discard it when we call the prefix function.

So the end result is that if you import a module ``"foo:bar"``, it will call the
``"foo:"`` prefix function with the arguments ``"foo:"`` and ``"bar"``.

::

  (define import-functions (make-hasheq))

  (hash-set! import-functions 'exclude
    (lambda (set args)
      (lambda (hash key value)
        (when (not (member key args))
          (set hash key value)))))

  (hash-set! import-functions 'include
    (lambda (set args)
      (lambda (hash key value)
        (when (member key args)
          (set hash key value)))))

  (hash-set! import-functions 'rename
    (lambda (set args)
      (lambda (hash key value)
        (let ((match (assoc key args)))
          (if match
            (set hash (cadr match) value)
            (set hash key value))))))

  (define (import-path module set path)
    (if (pair? path)
        (let ((name (car path))
              (rest (cadr path))
              (args (cddr path)))
          (import-path module
                       ((hash-ref import-functions name) set args)
                       rest))
        (import-boxes (import-get-module path) module set)))

  (with-module/path "std:builtins"
    (define-macro import args
      (let ((module (current-module)))
        (for ((path args))
          (import-path module import-boxes-set path))
        (void))))

The ``import`` macro can be used to load another module. It grabs the current
module and calls ``import-path`` for each module path.

The ``import-path`` function just grabs the module using ``import-get-module``,
and then uses ``import-boxes`` to import the boxes from that module into the
current module.

Right now it only supports loading files from the harddrive and loading ``std:``
modules. But as explained earlier, you can easily add new prefixes so that it
can support loading modules from a URL or Git repository. In fact, if you expose
the ``module-prefixes`` hash table, you could even let code define their own
prefixes.


When a module imports another module, the boxes go into ``'import-scope`` rather than
``'scope``.



Now let's test out our compiler:

::

  (define (get-all-expr module)
    (let ((seen (make-hasheq)))
      (let outer ((module module))
        (let inner ((imported (hash-ref module 'imported)))
          (if (null? imported)
              (hash-ref module 'expr)
              (let ((x (car imported)))
                (if (hash-has-key? seen x)
                    (inner (cdr imported))
                    (begin (hash-set! seen x #t)
                           (append (outer x)
                                   (inner (cdr imported)))))))))))

The above function will recursively find all the dependencies of the module,
and will then concatenate their code together in such a way that every module
appears before it is used, and no module appears twice.

Let's test it! Create a file called ``boxes-foo`` which contains this:

::


  #|(import "./boxes-bar")

  (define + (% +))

  (define foo (lambda (x) (+ x 5)))

  (foo bar)|#

And also create a file ``boxes-bar`` which contains this:

::

  (namespace-require 'racket/base)

  (define-syntax-rule (define-value name value)
    (eval (compile '(define name (% value)))))

  (with-module/path "std:builtins"
    (define-value + +))


::

  #|(define bar 20)|#

And now let's compile it:

::

  (define (repl)
    (let loop ()
      ;; This prompt catches all error escapes, including from read and print.
      (call-with-continuation-prompt
        (lambda ()
          (display "> ")
          (let ((input (read)))
            (unless (eof-object? input)
              (let ((output (eval (compile input))))
                (unless (void? output)
                  (displayln output))
                ;; Abort to loop. (Calling `loop' directly would not be a tail call.)
                ;(abort-current-continuation (default-continuation-prompt-tag))
                (loop)))))
        (default-continuation-prompt-tag)
        (lambda (x) (loop)))))

  (with-module/path "std:builtins"
    (with-module/path "std:repl"
      (repl)))

  ;(define file `(begin ,@(get-all-expr (compile-file "./boxes-foo"))))

  ;file
  ;(eval file)

Great, it works!

There's still some more stuff we need to do, though.
