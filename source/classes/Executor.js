'use strict';

var _ = require( 'lodash' );

module.exports = function( spindle ) {

	spindle.Executor = function( name, extension ) {

		this.init( name );
		_.extend( this, extension );

	};

	spindle.Executor.prototype = {

		init: function( name ) {

			this.name = name;
			this.alive = true;
			this.__threads = [];
			this.__paused = [];

		},

		busy: function() {

			return !!this.__threads.length;

		},

		traceThreads: function( async ) {

			var traces = [];

			var threadNameMap = {};

			_.each( this.__threads, function( thread, i ) {

				var threadName = 'thread' + i;

				traces.push( threadName + ': ' + thread.trace( async, null, threadNameMap ) );
				threadNameMap[ threadName ] = thread;

			} );

			return traces.join( "\n" );

		},

		wait: function( ms ) {

			return spindle.api.wait( ms, true );

		},

		waitOn: function( threadedFunction ) {

			return spindle.api.waitOn( threadedFunction, true );

		},

		waitFor: function( executor ) {

			return spindle.api.waitFor( executor || this, true );

		},

		pause: function() {

			this.paused = true;

			_.each( this.__threads, function( thread ) {

				thread.pause();
				this.__paused.push( thread );

			}, this );

		},

		resume: function() {

			this.paused = false;

			var pausedList = this.__paused;
			this.__paused = [];

			_.each( pausedList, function( thread ) {

				thread.resume();

			} );

		},

		stop: function() {

			_.each( this.__threads, function( thread ) {

				thread.stop();

			} );

		},

		die: function() {

			this.alive = false;
			_.each( Object.keys( this ), function( name ) {

				var exception = new Error( spindle.Thread.ERRORS.EXPIRED );
				var property = this[ name ];

				if ( property && property.__listeners ) {

					_.each( property.__listeners, function( listener ) {

						listener.fail( exception );

					} );

				}

			}, this );

		}

	};

};