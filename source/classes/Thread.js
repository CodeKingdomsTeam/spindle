'use strict';

var _ = require( 'lodash' );

module.exports = function( spindle ) {

	spindle.Thread = function( name, owner, parent ) {

		this.uid = spindle.Thread.uid++;
		this.name = name;
		this.owner = owner;
		this.parent = parent;
		this.state = spindle.Thread.STATES.READY;
		this.stack = [];

		var t = this;
		this.promise = spindle.promise( name, function( fulfil, fail ) {

			t._fulfil = fulfil;
			t._fail = fail;

		} );

	};

	spindle.Thread.uid = 0;

	spindle.Thread.STATES = {

		// The thread is ready to be run
		READY: 'ready',
		// The thread is currently running
		ACTIVE: 'active',
		// The thread is waiting on a promise, another thread or function
		WAITING: 'waiting',
		// The thread has finished running naturally
		FINISHED: 'finished',
		// The thread stopped running prematurely due to an
		// error or the stop method called on it
		STOPPED: 'stopped'

	};

	spindle.Thread.ERRORS = {

		INTERRUPTED: 'InterruptedException',
		EXPIRED: 'ExpiredExecutorException',

	};

	spindle.Thread.prototype = {

		_pushStack: function( name, args ) {

			var argsString = this._convertArgumentsToString( args );
			this.stack.push( name + '(' + argsString + ')' );

		},

		_popStack: function() {

			this.stack.pop();

		},

		after: function( fulfil, fail ) {

			return this.promise.then( fulfil, fail );

		},

		error: function( handler ) {

			this.promise.catch( handler );
			return this;

		},

		run: function( name, generator, args ) {

			this._pushStack( name, args );
			this.state = spindle.Thread.STATES.ACTIVE;

			var t = this;
			return spindle.run( generator, this ).then( function( result ) {

				t._popStack();

				return result;

			}, function( error ) {

				t._popStack();
				t._terminate( error );

			} );

		},

		start: function( name, generator, args ) {

			var t = this;

			// Run the generator and fulfil our promise when the thread is finished
			t.run( name, generator, args ).then( function( result ) {

				t.state = spindle.Thread.STATES.FINISHED;
				t._unlock();
				t._fulfil( result );

			}, t._terminate );

		},

		_terminate: function( error ) {

			this.state = spindle.Thread.STATES.STOPPED;
			this.reason = error;
			this._unlock();
			this._fail( error );

		},

		_lock: function() {

			this.owner.__thread = this;

		},

		_unlock: function() {

			if ( this.owner && this.owner.__thread === this ) {

				this.owner.__thread = null;

			}

		},

		throw: function( error ) {

			if ( this.state === spindle.Thread.STATES.WAITING ) {

				this._waitFail( error );

			} else {

				this._terminate( error );

			}

		},

		stop: function() {

			if ( this.state === spindle.Thread.STATES.WAITING ) {

				spindle.waiting.splice( spindle.waiting.indexOf( this ), 1 );
				this._wake();

			}

			this._terminate( new Error( 'InterruptedException' ) );

		},

		block: function( run ) {

			return this.wait( run, true );

		},

		_wake: function() {

			this.waitingFor = null;
			this._waitFulfil = null;

			this.state = spindle.Thread.STATES.ACTIVE;

			// Remove from the queue waiting on the executor
			if ( this.owner && this.owner.__threads ) {

				var threadIndex = this.owner.__threads.indexOf( this );
				if ( threadIndex !== -1 ) {

					this._lock();
					this.owner.__threads.splice( threadIndex, 1 );

				}

			}

		},

		wait: function( run, blocking ) {

			var t = this;

			return spindle.promise( 'wait', function( fulfil, fail ) {

				t.state = spindle.Thread.STATES.WAITING;
				spindle.waiting.push( t );

				// Add queue waiting on the executor
				if ( blocking ) {

					// If the executor is paused then pause ourselves
					if ( t.owner.paused ) {

						t.pause();
						t.owner.__paused.push( t );

					}

					// If we're the active thread for the executor
					// place us at the head of the queue so that
					// new threads blocking on the executor correctly
					// wake up after all the threads currently on the
					// executor block list have finished, rather than
					// just this one
					if ( t.owner.__thread === t ) {

						t.owner.__threads.unshift( t );

					} else {

						t.owner.__threads.push( t );

					}

				}

				t._waitFulfil = function( result ) {

					// Check if the thread has stopped
					if ( t.state === spindle.Thread.STATES.STOPPED ) {

						return;

					}

					if ( blocking ) {

						spindle.waiting.splice( spindle.waiting.indexOf( t ), 1 );

					}

					t._wake();
					fulfil( result );

				};

				t._waitFail = function( error ) {

					// Check if the thread has stopped
					if ( t.state === spindle.Thread.STATES.STOPPED ) {

						return;

					}

					if ( blocking ) {

						spindle.waiting.splice( spindle.waiting.indexOf( t ), 1 );

					}

					t._wake();
					fail( error );

				};

				run( t._waitFulfil, t._waitFail );

			} );

		},

		pause: function() {

			if ( this.paused ) return;

			this.paused = true;

			var t = this;
			this._pausePromise = spindle.promise( 'pause', function( fulfil ) {

				t._pauseFulfil = fulfil;

			} );

		},

		resume: function() {

			if ( !this.paused ) return;

			var pauseFulfil = this._pauseFulfil;

			this.paused = false;

			this._pausePromise = null;
			this._pauseFulfil = null;

			this.state = spindle.Thread.STATES.ACTIVE;

			pauseFulfil();

		},

		waitingOn: function( thread ) {

			if ( this.waitingFor ) {

				if ( this.waitingFor === thread ) return true;

				return this.waitingFor.waitingOn( thread );

			}

			return false;

		},

		_convertArgumentsToString: function( args ) {

			return _.map( [].slice.call( args ), function( arg ) {

				if ( typeof arg === 'object' ) {

					return arg.__schema ? arg.__schema.name : 'object';

				}

				if ( typeof arg === 'function' ) {

					return arg.__schema ? arg.__schema.name : 'function';

				}

				return arg;


			} ).join( ', ' );

		},

		trace: function( async, asyncParent, threadNameMap ) {

			// If the thread is named in the map then use that name
			var threadName = _.findKey( threadNameMap, function( thread ) {

				return thread === this;

			}, this );

			if ( threadName ) {

				return threadName;

			}

			var ownerString = this.owner && this.owner.name ? this.owner.name + ': ' : '';
			var myStackString = ownerString + this.stack.join( ' -> ' );

			if ( async && this.waitingFor ) {

				myStackString += ' <<< [ ' + this.waitingFor.trace( async, this, threadNameMap ) + ' ]';

			}

			if ( this.parent && this.parent === asyncParent ) {

				return '* ==> ' + myStackString;

			} else if ( this.parent ) {

				return this.parent.trace( false, null, threadNameMap ) + ' ==> ' + myStackString;

			}

			return myStackString;

		}

	};

};