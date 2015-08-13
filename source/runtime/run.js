'use strict';

var _ = require( 'lodash' );

module.exports = function( spindle ) {

	_.extend( spindle, {

		fire: function( threadedFunction, result, isError ) {

			var listeners = threadedFunction.__listeners;
			threadedFunction.__listeners = [];

			listeners.map( function( listener ) {

				if ( isError ) {

					listener.fail( result );

				} else {

					listener.fulfil( result );

				}

			} );

		},

		/*
		 * Run a compiled function in the form of a generator
		 * as the thread provided. Returns a promise that is
		 * fulfilled when the thread has completed execution.
		 */
		run: function( generator, thread ) {

			// Enforce generator
			if ( !spindle.isGenerator( generator ) ) {

				spindle.console.trace();
				throw new Error( "run can only take a generator but instead found: " + generator );

			}

			thread = thread || new spindle.Thread( 'main' );

			return spindle.promise( thread.name, function( fulfil, fail ) {

				var process = function( result, isError ) {

					// Don't continue if the thread has been stopped
					if ( thread.state === spindle.Thread.STATES.STOPPED ) {

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

					spindle.stack.push( thread );
					spindle.currentThread = thread;
					thread.state = spindle.Thread.STATES.ACTIVE;

					var output = spindle._next( generator, result, isError );

					if ( !output ) {

						return;

					}

					spindle.stack.pop();
					spindle.currentThread = _.last( spindle.stack );

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

		},

		_next: function( generator, result, isError ) {

			try {

				if ( isError ) {

					return generator.throw( result );

				} else {

					return generator.next( result );

				}

			} catch ( e ) {

				spindle.stack.pop();
				spindle.currentThread.throw( e );
				return;

			}

		}

	} );

};