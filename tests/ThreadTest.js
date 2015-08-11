'use strict';

var spindle = require( '../source/index.js' )();
var _ = require( 'lodash' );

var assert = require( 'chai' ).assert;

var passThrough = function( number ) {

	return spindle.promise( 'passThrough', function( fulfil ) {

		fulfil( number );

	} );

};

describe( 'thread', function() {

	beforeEach( function() {

		spindle.stack = [];

	} );

	// jshint esnext: true 
	it( 'Basic thread', function( done ) {

		var testFn = spindle.thread( 'testFn', function*( inputA, inputB ) {

			return ( yield passThrough( inputA ) ) + ( yield passThrough( inputB ) );


		} );

		spindle.run( ( function*() {

			return yield testFn( 1, 3 );

		} )() ).then( function( result ) {

			assert.equal( result, 4 );
			done();

		} );

	} );

	// jshint esnext: true
	it( 'Thread hierarchy', function( done ) {

		var stacks = [];

		var checkThread = function() {

			stacks.push( _.last( spindle.stack ).trace() );
			return 8;

		};

		var a = spindle.thread( 'a', function*() {

			yield d();
			return yield b();

		} );

		var b = spindle.thread( 'b', function*() {

			yield d();
			return yield c();

		} );

		var c = spindle.thread( 'c', function*() {

			return checkThread();

		} );

		var d = spindle.thread( 'd', function*() {

			return checkThread();

		} );

		spindle.run( ( function*() {

			return yield a();

		} )() ).then( function() {

			assert.deepEqual( stacks, [ 'a() -> d()', 'a() -> b() -> d()', 'a() -> b() -> c()' ] );
			done();

		} );

	} );

	// jshint esnext: true

	it( 'No Block', function( done ) {

		var x = 0;

		var bill = new spindle.Executor( 'bill', {

			step: spindle.thread( 'step', function*( input ) {

				yield this.wait();
				x = 1;
				return input;

			} )

		} );

		var dave = {};

		// Function not called with anything
		spindle.thread( 'main', function*() {

			yield bill.step( 4 );
			assert.equal( x, 0 );
			done();

		} ).call( dave );

	} );

	// jshint esnext: true
	it( 'Block', function( done ) {

		var x = 0;

		var bob = new spindle.Executor( 'bob', {

			step: spindle.thread( 'step', function*( input ) {

				yield this.wait();
				x = 1;
				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			yield this.step( 5 );
			assert.equal( x, 1 );
			done();

		} ).call( bob );

	} );

	// jshint esnext: true
	it( 'Wait for block', function( done ) {

		var x = 0;

		var steve = new spindle.Executor( 'steve', {

			step: spindle.thread( 'step', function*( input ) {

				yield this.wait();
				x = 1;
				return input;

			} )

		} );

		var alan = {

			name: 'alan'

		};

		spindle.thread( 'main', function*() {

			var steveThread = yield steve.step( 10 );
			var stepOutput = yield spindle.api.waitFor( steveThread );
			assert.equal( stepOutput, 10 );
			assert.equal( x, 1 );
			done();

		} ).call( alan );

	} );

	// jshint esnext: true
	it( 'Block hierarchy', function( done ) {

		var x = 0;

		var dan = new spindle.Executor( 'dan', {

			otherFn: spindle.thread( 'otherFn', function*( input ) {

				return ( yield this.step( input ) ) + ( yield this.step( input ) );

			} ),

			step: spindle.thread( 'step', function*( input ) {

				yield this.wait();
				x = 1;
				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			var output = yield dan.otherFn( 10 );
			assert.equal( output, 20 );
			assert.equal( x, 1 );
			done();

		} ).call( dan );

	} );

	// jshint esnext: true
	it( 'Stack traces during block and non-block', function( done ) {

		var count = 0;
		var assertThread = function( trace ) {

			count++;
			assert.equal( _.last( spindle.stack ).trace(), trace );

		};

		var greg = new spindle.Executor( 'greg', {

			otherFunction: spindle.thread( 'otherFunction', function*( input ) {

				assertThread( 'greg: main() -> otherFunction(10)' );
				return this.blockingFunction( input );

			} ),

			blockingFunction: spindle.thread( 'blockingFunction', function*( input ) {

				assertThread( 'greg: main() -> otherFunction(10) -> blockingFunction(10)' );
				yield this.wait();
				return input;

			} )

		} );

		var tim = new spindle.Executor( 'tim', {

			otherFunction: spindle.thread( 'otherFunction', function*( input ) {

				assertThread( 'greg: main() ==> tim: otherFunction(10)' );
				return this.blockingFunction( input );

			} ),

			blockingFunction: spindle.thread( 'blockingFunction', function*( input ) {

				assertThread( 'greg: main() ==> tim: otherFunction(10) -> blockingFunction(10)' );
				yield this.wait();
				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			yield this.otherFunction( 10 );
			assertThread( 'greg: main()' );

			var z = yield tim.otherFunction( 10 );

			yield tim.otherFunction( 10 );
			assertThread( 'greg: main()' );

			yield spindle.api.waitFor( z );
			assertThread( 'greg: main()' );

			assert.equal( count, 9 );

			done();

		} ).call( greg );

	} );

	// jshint esnext: true
	it( 'Stack traces for embedded functions', function( done ) {

		var count = 0;
		var assertThread = function( trace ) {

			count++;
			assert.equal( _.last( spindle.stack ).trace(), trace );

		};

		var simpleExecutor = new spindle.Executor( 'simpleExecutor', {

			otherFunction: spindle.thread( 'otherFunction', function*( input ) {

				assertThread( 'simpleExecutor: main() -> otherFunction(10)' );
				return this.blockingFunction( input );

			} ),

			blockingFunction: spindle.thread( 'blockingFunction', function*( input ) {

				yield spindle.api.wait();
				return input;

			} ),

			afterFunction: spindle.thread( 'afterFunction', function*( inputA, inputB ) {

				assertThread( 'simpleExecutor: main() -> afterFunction(10, blockingFunction)' );
				var outputB = yield inputB.call( this, 10 );
				var outputC = yield inputB( 10 );
				return inputA + outputB + ( yield spindle.api.waitFor( outputC ) );

			} ),

		} );

		spindle.thread( 'main', function*() {

			assertThread( 'simpleExecutor: main()' );
			var output = yield this.afterFunction( yield this.otherFunction( 10 ), this.blockingFunction );
			assertThread( 'simpleExecutor: main()' );
			return output;

		} ).call( simpleExecutor ).after( function( output ) {

			assert.equal( count, 4 );
			assert.equal( output, 30 );
			done();

		} );

	} );

	// jshint esnext: true 
	it( 'Detect and handle self wait', function( done ) {

		var threadA = spindle.thread( 'main', function*() {

			yield spindle.api.wait();
			// TODO WARN IF YOU WAIT ON YOURSELF
			var result = yield spindle.api.waitFor( threadA );

			assert.equal( result, undefined );

			done();

		} )();

	} );

	// jshint esnext: true 
	it( 'Detect and handle cyclic dependency', function( done ) {

		var threadA = spindle.thread( 'main', function*() {

			yield spindle.api.wait();
			var result = yield spindle.api.waitFor( threadB );

			assert.equal( result, undefined );

			return 4;

		} )();

		var threadB = spindle.thread( 'main', function*() {

			var result = yield spindle.api.waitFor( threadA );

			assert.equal( result, undefined );

			done();

		} )();

	} );

} );