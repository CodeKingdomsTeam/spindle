'use strict';

var spindle = require( '../source/index.js' )();
var _ = require( 'lodash' );

var assert = require( 'chai' ).assert;

var passThrough = function( number ) {

	return spindle.promise( 'passThrough', function( fulfil ) {

		fulfil( number );

	} );

};

describe( 'pause', function() {

	beforeEach( function() {

		spindle.stack = [];
		spindle.waiting = [];

	} );


	it( 'Pause and resume a thread', function( done ) {

		var walk = 0;

		var toby = new spindle.Executor( 'toby', {

			walk: spindle.thread( 'walk', function*() {

				yield this.wait();

				walk = 1;

			} )

		} );

		spindle.thread( 'main', function*() {

			var thread = yield toby.walk( 2 );

			yield thread.pause();

			yield spindle.api.wait();

			assert.equal( walk, 0 );

			yield thread.resume();

			yield spindle.api.waitFor( thread );

			assert.equal( walk, 1 );

			done();


		} )();

	} );


	it( 'Pause and resume an executor', function( done ) {

		var walk = 0;

		var toby = new spindle.Executor( 'toby', {

			walk: spindle.thread( 'walk', function*() {

				yield this.wait();

				walk = 1;

			} )

		} );

		spindle.thread( 'main', function*() {

			yield toby.pause();

			var thread = yield toby.walk( 2 );

			yield spindle.api.wait();

			assert( thread.paused );

			assert.equal( walk, 0 );

			yield toby.resume();

			assert( !thread.paused );

			yield spindle.api.waitFor( thread );

			assert.equal( walk, 1 );

			done();


		} )();

	} );


} );


describe( 'stop', function() {

	beforeEach( function() {

		spindle.stack = [];
		spindle.waiting = [];

	} );


	it( 'Stop spawned thread', function( done ) {

		var walk = 0;

		var toby = new spindle.Executor( 'toby', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield this.waitFor();
				yield this.wait();

				walk = 1;

				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			yield toby.walk( 2 );
			yield toby.stop();

			yield spindle.api.wait();

			assert.equal( walk, 0 );
			done();

		} )();

	} );


	it( 'Waiting on a stopped thread makes you continue', function( done ) {

		var walk = 0;

		var toby = new spindle.Executor( 'toby', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield this.waitFor();
				yield this.wait( 10000 );

				walk = 1;

				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			var thread = yield toby.walk( 2 );

			yield toby.stop();

			yield spindle.api.waitFor( thread );

			assert.equal( thread.state, spindle.Thread.STATES.STOPPED );

			assert.equal( walk, 0 );
			done();

		} )();

	} );


	it( 'Stop removes all threads from an executor', function( done ) {

		var walk = 0;

		var toby = new spindle.Executor( 'toby', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield this.wait();

				walk++;

				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			yield toby.walk( 2 );
			yield toby.walk( 2 );
			yield toby.walk( 2 );
			yield toby.walk( 2 );

			yield toby.stop();
			yield spindle.api.wait();

			assert.equal( toby.busy(), false );
			assert.equal( walk, 0 );
			done();

		} )();

	} );


	it( 'You can stop yourself', function( done ) {

		var walk = 0;

		spindle.thread( 'main', function*() {

			yield spindle.currentThread.stop();

			walk = 1;

		} )().promise.catch( function() {

			assert.equal( walk, 0 );
			done();

		} );

	} );

} );