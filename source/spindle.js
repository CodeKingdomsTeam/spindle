'use strict';

CK.threads.stack = [];
CK.threads.waiting = [];
CK.threads.blocked = [];

/* global Promise: true */
CK.threads.promise = function( name, run ) {

	var promise = new Promise( run );
	promise.name = name;
	return promise;

};

CK.threads.parse = function( text, suppressWarnings ) {

	if ( !text ) return;

	var comments = [];

	try {
		var parsed = acorn.parse( text, {

			onComment: function( block, content, start, end ) {

				comments.push( {
					block: block,
					content: content,
					start: start,
					end: end
				} );

			}

		} );

		parsed.comments = comments;

		return parsed;

	} catch ( e ) {

		if ( !suppressWarnings ) {

			console.warn( "Couldn't parse text: " + text, e );

		}
		return;
	}
};

CK.threads.isGenerator = function( it ) {
	return it && it.next;
};

CK.threads.method = function( fnOrString, schema ) {

	var string;
	var name = 'fn';

	// Calculate the name of the function and its string representation
	if ( _.isString( fnOrString ) ) {

		string = fnOrString;

		// Match the name of the function
		var nameMatch = fnOrString.match( /^function\s([^(]+)/ );

		if ( nameMatch ) {

			name = nameMatch[ 1 ];

		}

	} else {

		string = fnOrString.toString();
		name = fnOrString.name || name;

	}

	if ( _.isObject( schema ) ) {

		name = schema.name || 'fn';

	}

	var prefix = string.match( /[^(]+/ )[ 0 ];

	// Ensure the function is named so that acorn can parse it
	var namedString = 'function ' + name + string.substring( prefix.length );

	// Use strict for the compiled function
	var USE_STRICT = "'use strict';\n";

	var output = CK.threads.translate( CK.threads.parse( namedString ) );

	// Try creating the function with generators
	var compiledFunction;

	try {

		compiledFunction = new Function( USE_STRICT + 'return ' + output )();

	} catch ( e ) {

		try {

			// If generators are not supported then use babel to translate them
			/* global babel: true */
			output = babel.transform( output, {
				loose: "all"
			} );
			output = USE_STRICT + 'return ' + output.code.substring( USE_STRICT.length );
			compiledFunction = new Function( output )();

		} catch ( e2 ) {

			CK.Logger.warn( "Bad function " + name, e2 );
			return function() {};

		}

	}

	if ( schema ) {

		compiledFunction.__schema = schema;

	}

	compiledFunction.compiled = true;

	return compiledFunction;

};

/*
 * Returns a function that runs the generator function
 * with the arguments provided, creating a new thread
 * of the name provided. If the thread that calls this
 * function has the same owner, the execution will be
 * continued by that thread, otherwise a new thread will
 * will be returned, allowing execution to continue in
 * parallel.
 */
CK.threads.$thread = function( name, generatorFn ) {

	var fn = function() {

		// Evaluate generator function to get generator
		var generator = generatorFn.apply( this, arguments );

		var parent = _.last( CK.threads.stack );
		var thread = parent;

		// Create a new thread if the function should run
		// independently of the parent thread
		if ( !parent || parent.owner !== this ) {

			thread = new CK.threads.Thread( name, this, parent );
			thread.promise.then( function( result ) {

				CK.threads.$fire( fn, result, false );

			}, function( error ) {

				// TODO threads: handle errors correctly
				console.warn( 'Thread Error [', thread.trace(), ']', error );

			} );
			thread.start( name, generator, arguments );

			return thread;

		}

		return thread.run( name, generator, arguments );

	};
	fn.__listeners = [];
	fn.__schema = {
		name: name
	};
	return fn;

};

CK.threads.$fire = function( threadedFunction, result, isError ) {

	var listeners = threadedFunction.__listeners;
	threadedFunction.__listeners = [];

	listeners.map( function( listener ) {

		if ( isError ) {

			listener.fail( result );

		} else {

			listener.fulfil( result );

		}

	} );

};

/*
 * Run a compiled function in the form of a generator
 * as the thread provided. Returns a promise that is
 * fulfilled when the thread has completed execution.
 */
CK.threads.$run = function( generator, thread ) {

	// Enforce generator
	if ( !CK.threads.isGenerator( generator ) ) {

		console.trace();
		throw new Error( "$run can only take a generator but instead found: " + generator );

	}

	thread = thread || new CK.threads.Thread( 'main' );

	return CK.threads.promise( thread.trace(), function( fulfil, fail ) {

		var process = function( result, isError ) {

			// Don't continue if the thread has been stopped
			if ( thread.state === CK.threads.Thread.STATES.STOPPED ) {

				fail( thread.error );
				return;

			}

			// Don't continue if the thread has been stopped
			if ( thread.paused ) {

				thread._pausePromise.then( function() {

					process( result, isError );

				} );
				return;

			}

			CK.threads.stack.push( thread );
			CK.threads.active = thread;
			thread.state = CK.threads.Thread.STATES.ACTIVE;

			var output;

			try {

				if ( isError ) {

					output = generator.throw( result );

				} else {

					output = generator.next( result );

				}

			} catch ( e ) {

				CK.threads.stack.pop();
				CK.threads.active.throw( e );

				return;

			}

			CK.threads.stack.pop();
			// TODO ENSURE THIS IS CORRECT
			CK.threads.active = _.last( CK.threads.stack );

			// TODO COMMENT
			if ( output.done ) {

				fulfil( output.value );

				// TODO COMMENT
			} else if ( output.value && output.value.then ) {

				output.value.then( process, processError );

				// TODO COMMENT
			} else {

				process( output.value );

			}

		};

		var processError = function( error ) {

			process( error, true );

		};

		process();

	} );

};