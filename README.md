# Javascript Threads

## Objectives

1. A straight-forward threading system given requirements
2. Unit tested
3. Compiled code is easy to debug
4. Compiled code can be inspected
4. Compiled code is readable
5. Current 'system' code re-written as game code e.g. _walk

## Conception

Why are the features of our interpreter needed for running game code?

### Waiting

1.

Consider:

```
this.walk(NORTH);
if (this.distanceFrom(ButtonA) < 3) {
    this.walk(SOUTH);
}
```

To execute this code correctly, the walk method must block until it is complete, otherwise the distance comparison will take place from the wrong place.

2.

Consider:

```
while (true) {
    this.jump();
}
```

The thread should wait for a short while after this jump to prevent the game from crashing.

3.

Consider:

```
this.jump();
setTimeout(function() {

    this.jump();

}, 200);
```

and compare to:

```
this.jump();
wait(200);
this.jump();
```

Waiting often produces cleaner code.

### Blocking

1.

Consider two buttons:

```
ButtonA.onPress = function() {
    player.walk(NORTH);
};

ButtonB.onPress = function() {
    player.walk(SOUTH);
};
```

The intended behaviour for this is that the player walks north when button A is pressed and south when button B is pressed. If they are pressed at the same time, the player executes the commands in the order that they are generated.

While the player can't walk south, the button B walk command is blocked, in that it can't issue the player.walk command. Once the player has finished walking north, the button B thread executes the walk command.

### Executors

The player must have a notion that it is currently busy while walking and be able to wake up the button B thread when it has finished walking. This functionality encodes an 'executor'. Threads can wait or block on an executor in an ordered list, where a block can be considered as a wait which, when woken up, retries the same command or returns to block state until it succeeds.

### Ownership

1.

Consider the button:

```
ButtonC.onPress = function() {
    
    for (var glitch in glitches) {
        glitch.walkTowards(player);
        glitch.jump();
    }

};
```

The intended behaviour for this is that the glitches all walk towards the player at the same time, jumping when they get to the player. For this to be possible, each iteration of the for-loop must run in a seperate context, each owned by a different glitch.

In general, deciding what parts of the code must be owned by who isn't tractable as it is dependent on what the coder wants to do, so a simple solution which allows the most common behaviours to be written is needed.

In Javascript, a simple definition of ownership is formed by introducing a 'this' parameter when a function is called, either automatically by calling the function as a property of an object, or explicitly binding it with methods like *call*.

Using the same definition seems sensible for thread ownership.

Consider:

```
ButtonC.onPress = function() {
    
    for (var glitch in glitches) {

        glitch.performAction = function() {

            this.walkTowards(player);
            this.jump();

        };

        glitch.performAction();

    }

};
```

It makes sense in this example for the performAction method to be owned by the glitch during execution. As the outside function is owned by the button, the waiting commands are not passed through to it and the button executes the performAction for all glitches simultaneously. However, inside the performAction functions, the walkTowards command does wait and the jump won't be executed until it has been completed.

2.

In general we don't want to assign a function to a glitch just to make it own a thread. It would be much simpler to define performAction as an anonymous function.

Using ```call()``` can achieve this:

```
var performAction = function() {
    
    this.walkTowards(player);
    this.jump();

};

for (var glitch in glitches) {

    performAction.call(glitch);
    
}
```

3.

What if we actually *want* the glitches to walkTowards the player one at a time?

Consider:

```
ButtonC.onPress = function() {
    
    for (var glitch in glitches) {
        glitch.walkTowards(player);
    }

};
```

A solution to this is implement ```waitFor```, which pauses the thread until the glitch has completed the previous action:

```
ButtonC.onPress = function() {
    
    for (var glitch in glitches) {
        glitch.walkTowards(player);
        waitFor(glitch);
    }

};
```
In this example, because the button doesn't own the glitch, the walkTowards is executed in separate thread that is 'owned' by the glitch. The ```waitFor``` method gets this thread from the glitch (as an Executor) and waits the button thread on its completion.

### Exclusivity

We've established that the ownership of a thread is important in allowing concurrency (e.g. button makes many glitches move at once), and that a simple way to implement this is by the 'this' that a function runs with.

But how do functions actually specify that they block other threads / or can block on other threads?

1.

Given a basic implementation of walk:

```
glitch.walk = function( direction ) {

    var moved = true;
    
    while (moved) {
    
        this.step(direction);
        moved = ...;

    }
    
};
```

Consider the commands given to an instance:

```
glitch.walk(NORTH);
glitch.walk(SOUTH);
```

If they run in parallel, this will have the effect of not moving the glitch in any direction, because each frame ```step(NORTH)``` and ```step(SOUTH)``` commands are issued which cancel each other out.

What makes a function like walk 'block' a thread?

Try adding a mutex:
```
glitch.walk = function( direction ) {
    
    waitFor(this);
    ...

};
```

In the same way we used waitFor above to pause a thread until an executor had finished it, this will prevent the walk from starting until another thread has finished executing that is owned by the glitch.

2.

Currently, system code adds a task to the Executor during the walk command, but this has a number of disadvantages:

* It requires each blocking method to have metadata defined outside the definition
* It requires explicit setup and teardown methods
* The executing task is currently only a low-level internal method. For example, if an animal is navigating, the task running is 'walk'

A lightweight solution which avoids metadata is to try and use the low-level asynchronous thread functions we already have to create blocking.

* A ```wait()``` or ```waitFor``` command pauses the current thread and locks the thread owner
* A while loop pause pauses the current thread and locks the thread owner
* Any compiled asynchronous function which is called by a thread with the same owner pauses the current thread and locks the owner

If we consider the walk function from above, the first command will produce ```step(NORTH)``` which locks the executor to that thread until it has finished executing.

Adding a function to the Executor which traces thread dependencies:

```
=> step(NORTH) -> walk(NORTH) -> navigateTo(ButtonC) -> ButtonC.onPress()
```

Which is a much cleaner way of abstracting a task.

3.

However, a problem with this is that the only way we can prevent a thread owned by the glitch from blocking is to run its executions in an anonymous function, which is difficult to write simply.

An alternative is to make executors have atomic blocking functions, such as ```this.wait()``` and ```this.waitFor()```. Unlike their waiting peers, these methods will cause the thread to block others.

Using the infrastructure we've already designed, a simple way to achieve this is to make a choice between ```wait``` and ```this.wait```

Consider:

```
this.walk(NORTH);
this.wait(5);
this.jump();
```

where we want another thread to be able to issue a blocking command during the wait.

A possible solution to this demand:

```
this.walk(NORTH);
wait(5);
this.jump();
```

Here, this has the desired effect in allowing the glitch to execute different commands while the wait occurs.

4.

What if you want the ```wait(5)``` to start the moment the glitch starts walking? Run the functionality in an anonymous function.

```
(function( glitch ) {

    glitch.walk(NORTH);
    wait(5);
    glitch.jump();

})(this);
```

How about if you want the wait to start the moment the glitch begins walking? Move the ```waitFor(glitch)``` before the walk command.

5.

With this implementation, it is possible to achieve a full range of threading behaviour. The code below executes a plan for another entity, and frees the glitch executor once the something has finished executing:

```
glitch.tellSomeoneToDoSomething = function( someone, something ) {

    something.call(someone);
    this.waitFor(someone);

}
```

### Behaviours

Exclusivity works well as we generally only want an entity to have a single active behaviour running at a time. However, the decision as to which behaviours to run should be parallelised, with the ability to bind more than one function.

One nice way to implement this at execution level would be to allow threads to wait on functions:

```
waitFor(glitch.die);
glitch.speak('dead');
```

To bind a constant behaviour:
```
while (true) {
    var entity = waitFor(this.alert);
    this.exclaim('o no!');
    this.walkTowards(entity);
}
```

A nice result of this is that all the exclusive thread behaviours discussed above are possible - you can easily control whether or not you want the behaviour to happen repeatedly, or only once, or only if another behaviour is not active.

Non-blocking behaviour:
```
while (true) {

    var entity = waitFor(this.alert);

    // Run in a separate thread
    (function( glitch ) {
        
        glitch.stop();
        glitch.exclaim('o no!');
        glitch.walkTowards(entity);
        
    })(this);

}
```

Run only if an earlier listener hasn't:
```
while (true) {

    waitFor(this.alert);
    
    if (!this.busy) {
        this.walk(NORTH);
    }

}
```

Chain behaviours one after the other:
```
while (true) {

    waitFor(this.alert);
    this.walk(NORTH);

}
```

## Requirements

1. Map global variables onto a root object e.g. Position -> CK.api.Position
2. Special handling for language e.g. ```NORTH === Direction(0)```;
3. A function can wait, with code continuing after executing asynchronous code
4. An executor has a list of threads ```executor.threads``` which are currently trying to executing code on it.

### Interoperability

Currently, both compiled and native functions need to interoperate with each other. By providing the same definition of a function's execution before and after compile, this should simplify handling different types of functions.

### No metadata

Using the native style of producing waiting / blocking should also mean that all functions act in the same way, and don't require special handling if they block or wait a thread.

## API

### A Compiled Statement

Consider a basic asynchronous command:

```wait( ms )```

We want a transformation that generalises asynchronous behaviour to any function call.
Typically promises are seen as easier to work with when writing.

```
var promise = aCompiledFunction( args );
promise.then(function( result ) { ... });
```

Consider the code:

```
wait(2);
var x = this.walk(NORTH);
wait(x);
```
If we use generators we can recursively evaluate promises that are returned from asynchronous functions:

```
yield wait(2);
var x = yield this.walk(NORTH);
yield wait(2);
```

This is a much more compact representation, but requires support for generators. Fortunately, BabelJS can be used to simulate them on older browsers.

To interpret a function like this we would evaluate any promises that are yielded and pass them through to the next function, until the promise was complete.

```
$run = function( generator ) {
    
    return new Promise(function( fulfil, fail ) {
    
        var process = function() {
        
            var output = generator.next(result);
            
            if (output.done) {
            
                fulfil(output.value);
                
            } else {
            
                output.value.then(process);
                
        };
        
        process();
        
    });

};
```

A generator could then be called like so:

```
$run(function* () {

    yield wait(2);
    var x = yield this.walk(NORTH);
    yield wait(2);

});
```

### A basic wait function

A simple implementation of wait might look like:

```
function( ms ) {

    return new Promise(function( fulfil ) {
    
        setTimeout(fulfil, ms);

    });

}
```
This can now be called in a generator like so:
```
yield wait(ms);
```

### Translating functions

A function should translate into a generator. Given the input:
```
glitch.fn = function( dir, other ) {
    this.walk(dir);
    wait(2);
    return this.distanceFrom(other);
};
var r = glitch.fn(dir, other);
```
The translation is two-fold - first, a translation into a generator and secondly, passing into a function which returns a promise that evaluates the function with $run.
```
glitch.fn = $thread(function* ( dir, other ) {

    yield this.walk(dir);
    yield wait(2);
    return this.distanceFrom(player);
    
});

var r = yield glitch.fn(dir, other);
```

A simple implementation of $thread:
```
// Make function returns required output from input function
var $thread = function( generatorFn ) {

    return function() {
    
        // Set up thread state
        CK.code.thread = ...
        
        var generator = generatorFn.apply(this, arguments);

        return $run(generator).then(function() {
            
            // Teardown thread state
            
        });
        
    };

};
```

Notice that functions in the system aren't written to return promises, and we still want to work with them. Fortunately, we can adapt ```$run``` to ensure raw results are passed-through in a way the compiler can interpret.

```
$run = function( generator ) {
    
    output = generator.next();
    
    if (notPromise(output)) {
        generator.next(output);
    } else {
    
    // ...
    
};
```

### Translating loops

Like wait, loops need to stop a thread of execution and block the thread owner. To do this, we can simply insert a wait after the body:
```
while ($condition) {
    $body
    yield wait();
}
```
If a loop has been yielded for a frame or more during its iteration then we don't need to wait before iterating - this will prevent e.g. a constant step motion from having gaps during the walk.

This behaviour can be implemented by a frame check:
```
while ($condition) {
    var $frame0 = CK.clock.time;
    $body
    yield waitUntil($frame0 + 1);
```

## Executors

An executor can have a number of threads blocked on it at any one time:

```
executor = {
    __threads: [],
    busy: false
}
```

An executor is busy if there is a thread owned by the executor that is currently waiting. If another thread is run that is owned by the executor when it is busy, it is paused and placed on the thread list and will not resume until all the threads above it have finished and been removed from the threads array.

* A thread has a ```wait``` function that is called when the thread has to yield due to a waiting promise.
* A thread has a ```block``` function which is called if its executor is busy when it is started.

### Blocking

When a thread blocks, it prevents an executor from performing any other actions until it has completed. The thread will resume when the waiting promise resolves. If there is already a thread blocked on the executor, this thread is added to the executor's ```__threads``` list, and it will only resume once the blocked thread at the end of that list has finished.

## Tools

With the new thread system some new functions are going to be useful

### withSchema

It would be nice to attribute a schema to a function (or even dictionary object) in its definition, rather than assigning to a property after definition.

So instead of:

```
(function() {

    var fn = function() {
        // ...
    };
    
    fn.parameters = [];
    return fn;
    
})();
```

You get:

```
CK.code.withSchema(function() {
    
    ...

}, {
    waiting: true
})
```

### preCompile

Pre-compilation is a proposed solution that would enable code written by developers in game JS to be compiled when the game is built, providing the ability to inspect it easily during runtime.

Given:

```
// @compile
onAlert: function() {
    wait(200);
    this.jump();
}
```

Output:
```
// @compiled
onAlert: CK.code.thread(function() {
    
    
    
});
```

```
setDifficulty()
.placeWhileLoop()
.placeInBlock(lang, 'obstacle.solve', 'while(true)', DENY_DRAG_CHECK)
```
