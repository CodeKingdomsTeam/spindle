'use strict';

var spindle = require( '../source/index.js' )();
var _ = require( 'lodash' );
var assert = require( 'chai' ).assert;

var passThrough = function( number ) {

	return spindle.promise( 'passThrough', function( fulfil ) {

		fulfil( number );
		fulfil( number );

	} );

};

describe( 'Executor', function() {

	beforeEach( function() {

		spindle.stack = [];
		spindle.waiting = [];

	} );


	it( 'Basic executor', function( done ) {

		var totalDistance = 0;
		var walkers = 0;

		var mate = new spindle.Executor( 'mate', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield this.waitFor();

				walkers++;

				assert.equal( walkers, 1 );

				yield this.wait();

				assert.equal( walkers, 1 );

				walkers--;

				totalDistance += input;

				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			yield mate.walk( 2 );
			yield mate.walk( 4 );
			yield mate.walk( 5 );

			assert.equal( totalDistance, 0 );

			assert.equal( mate.traceThreads(), "thread0: main() ==> mate: walk(2)\nthread1: main() ==> mate: walk(4)\nthread2: main() ==> mate: walk(5)" );
			assert.equal( mate.traceThreads( true ), "thread0: main() ==> mate: walk(2)\nthread1: main() ==> mate: walk(4) <<< [ thread0 ]\nthread2: main() ==> mate: walk(5) <<< [ thread1 ]" );

			yield spindle.api.waitFor( mate );

			assert.equal( totalDistance, 11 );

			done();

		} )();

	} );


	it( 'Basic executor can own a thread', function( done ) {

		var totalDistance = 0;
		var walkers = 0;

		var guy = new spindle.Executor( 'guy', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield this.waitFor();

				walkers++;

				assert.equal( walkers, 1 );

				yield this.wait();

				assert.equal( walkers, 1 );

				walkers--;

				totalDistance += input;

				return input;

			} )

		} );

		var thread = spindle.thread( 'main', function*() {

			yield this.walk( 2 );
			yield this.walk( 4 );

			// Check that the thread is still active
			assert.equal( this.__thread, thread );

			assert.equal( totalDistance, 6 );

			done();

		} ).call( guy );

	} );


	it( 'Basic executor can block on another thread', function( done ) {

		var totalDistance = 0;
		var walkers = 0;

		var guy = new spindle.Executor( 'guy', {

			walkNiall: spindle.thread( 'walk', function*( input ) {

				niall.walk( input );

				yield this.waitFor( niall );

				return input;

			} )

		} );

		var niall = new spindle.Executor( 'niall', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield this.waitFor();

				walkers++;

				assert.equal( walkers, 1 );

				yield this.wait();

				assert.equal( walkers, 1 );

				walkers--;

				totalDistance += input;

				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			var thread = yield guy.walkNiall( 2 );
			yield guy.walkNiall( 4 );

			assert.equal( thread.state, spindle.Thread.STATES.WAITING );

			assert.equal( guy.traceThreads( true ), "thread0: main() ==> guy: walk(2) <<< [ * ==> niall: walk(2) ]\nthread1: main() ==> guy: walk(4) <<< [ * ==> niall: walk(4) <<< [ thread0 ==> niall: walk(2) ] ]" );

			yield spindle.api.waitFor( guy );

			// Check that no threads are active
			assert.equal( guy.__threads.length, 0 );
			assert.equal( niall.__threads.length, 0 );
			assert.equal( guy.__thread, null );
			assert.equal( niall.__thread, null );

			assert.equal( totalDistance, 6 );

			done();

		} )();

	} );


	it( 'Executor has racing threads that run in order', function( done ) {

		var walkOutput = [];

		var tony = new spindle.Executor( 'tony', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield this.waitFor();

				yield this.wait();

				walkOutput.push( input );
				return input;

			} )

		} );

		spindle.thread( 'main0', function*() {

			yield this.walk( 2 );
			yield this.walk( 4 );

		} ).call( tony );

		spindle.thread( 'main1', function*() {

			yield this.walk( 6 );
			yield this.walk( 8 );
			assert.deepEqual( walkOutput, [ 2, 4, 6, 8 ] );
			done();

		} ).call( tony );

	} );


	it( 'Handle blocking correctly when calling functions across each other', function( done ) {

		var walkOutput = [];

		var dick = new spindle.Executor( 'dick', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield this.waitFor();
				yield this.wait();

				walkOutput.push( input );
				return input;

			} )

		} );

		var dom = new spindle.Executor( 'dom', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield this.waitFor();
				yield this.wait();

				walkOutput.push( input );
				return input;

			} )

		} );

		var threadA = spindle.thread( 'main', function*() {

			yield this.walk( 2 );
			var otherThread = yield dom.walk( 4 );

			var output = yield spindle.api.waitFor( otherThread );

			assert.equal( output, 4 );

		} ).call( dick );

		var threadB = spindle.thread( 'main', function*() {

			yield this.walk( 6 );
			var otherThread = yield dick.walk( 8 );

			var output = yield spindle.api.waitFor( otherThread );

			assert.equal( output, 8 );

		} ).call( dom );

		Promise.all( [ threadA.promise, threadB.promise ] ).then( function() {

			assert.deepEqual( walkOutput.sort(), [ 2, 4, 6, 8 ] );
			assert.equal( threadA.state, spindle.Thread.STATES.FINISHED );
			assert.equal( threadB.state, spindle.Thread.STATES.FINISHED );
			done();

		} );

	} );

} );