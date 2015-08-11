'use strict';

var _ = require( 'lodash' );

module.exports = function( spindle ) {

	_.extend( spindle, {

		/*
		 * Returns a function that runs the generator function
		 * with the arguments provided, creating a new thread
		 * of the name provided. If the thread that calls this
		 * function has the same owner, the execution will be
		 * continued by that thread, otherwise a new thread will
		 * will be returned, allowing execution to continue in
		 * parallel.
		 */
		thread: function( name, generatorFn ) {

			var fn = function() {

				// Evaluate generator function to get generator
				var generator = generatorFn.apply( this, arguments );

				var parent = _.last( spindle.stack );
				var thread = parent;

				// Create a new thread if the function should run
				// independently of the parent thread
				if ( !parent || parent.owner !== this ) {

					thread = new spindle.Thread( name, this, parent );
					thread.promise.then( function( result ) {

						spindle.fire( fn, result, false );

					}, function( error ) {

						// TODO threads: handle errors correctly
						spindle.console.warn( 'Thread Error [', thread.trace(), ']', error );

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

		}

	} );

};