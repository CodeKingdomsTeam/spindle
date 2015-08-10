'use strict';

_.extend( CK.api, {

	wait: function( ms ) {

		return CK.threads.active.wait( function( fulfil ) {

			setTimeout( function() {

				fulfil();

			}, ms );

		} );

	},

	// jshint esnext: true 
	waitFor: function( threadOrExecutor, blocking ) {

		var thread = threadOrExecutor;
		var currentThread = CK.threads.active;

		if ( threadOrExecutor && threadOrExecutor.__threads ) {

			var executor = threadOrExecutor;

			// Don't block if you're currently the executor's active thread
			if ( executor.__thread === currentThread ) {

				return;

			}

			thread = _.last( threadOrExecutor.__threads );

		}

		if ( !thread ) return;

		currentThread.waitingFor = thread;

		var waitPromise = currentThread.wait( function( fulfil ) {

			// Resume once the thread has ended
			thread.after( fulfil, fulfil );

		}, blocking );

		if ( thread.waitingOn( currentThread ) ) {

			console.warn( 'cyclic dependency' );
			console.warn( currentThread.trace() );
			console.warn( thread.trace() );

			// If a cyclic dependency occurs, ie. we try and
			// wait on the thread that is waiting on us, we
			// wake up that thread as we can't do anything
			// more until they are done. If this fulfil is
			// called, then the wait until the thread has
			// finished is ignored as promises can only be
			// fulfilled once
			thread._waitFulfil();

		}

		return waitPromise;

	},

	waitOn: function( threadedFunction, blocking ) {

		return CK.threads.active.wait( function( fulfil, fail ) {

			threadedFunction.__listeners.push( {

				fulfil: fulfil,
				fail: fail

			} );

		}, blocking );

	}

} );