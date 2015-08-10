'use strict';

global.acorn = require( 'acorn' );
global._ = require( 'lodash' );
global.Promise = require( 'bluebird' );

var assert = require( 'chai' ).assert;

global.CK = {

	threads: {},
	api: {}

};

require( '../../source/game/threads/Deferred.js' );
require( '../../source/game/threads/Thread.js' );
require( '../../source/game/threads/ThreadApi.js' );
require( '../../source/game/threads/Threads.js' );
require( '../../source/game/threads/Executor.js' );

var passThrough = function( number ) {

	return CK.threads.promise( 'passThrough', function( fulfil ) {

		fulfil( number );

	} );

};

var $run = CK.threads.$run;
var $thread = CK.threads.$thread;

describe( '$run', function() {

	beforeEach( function() {

	} );

	// jshint esnext: true 
	it( 'Basic run', function( done ) {

		$run( ( function*() {

			yield 2;
			return 3;

		} )() ).then( function( result ) {

			assert.equal( result, 3 );
			done();


		} );

	} );

	// jshint esnext: true 
	it( 'Pass through', function( done ) {

		$run( ( function*() {

			return ( yield passThrough( 2 ) ) + ( yield passThrough( 3 ) );

		} )() ).then( function( result ) {

			assert.equal( result, 5 );
			done();


		} );

	} );

	// jshint esnext: true 
	it( 'Simple return', function( done ) {

		var simpleReturn = function( input ) {

			return input;

		};

		$run( ( function*() {

			return ( yield passThrough( 2 ) ) + ( yield simpleReturn( 3 ) );

		} )() ).then( function( result ) {

			assert.equal( result, 5 );
			done();


		} );

	} );


	// jshint esnext: true 
	it( 'Loop body', function( done ) {

		$run( ( function*() {

			var y = 0;

			for ( var x = 0; x < 5; x++ ) {

				y += yield passThrough( x );

			}

			return y;

		} )() ).then( function( result ) {

			assert.equal( result, 10 );
			done();

		} );

	} );

	// jshint esnext: true 
	it( 'Loop condition', function( done ) {

		$run( ( function*() {

			var y = 0,
				x = 0;

			while ( ( yield passThrough( y++ ) ) < 10 ) {

				x++;

			}

			return x;

		} )() ).then( function( result ) {

			assert.equal( result, 10 );
			done();

		} );

	} );

} );


describe( '$thread', function() {

	beforeEach( function() {

		CK.threads.stack = [];

	} );

	// jshint esnext: true 
	it( 'Basic thread', function( done ) {

		var testFn = $thread( 'testFn', function*( inputA, inputB ) {

			return ( yield passThrough( inputA ) ) + ( yield passThrough( inputB ) );


		} );

		$run( ( function*() {

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

			stacks.push( _.last( CK.threads.stack ).trace() );
			return 8;

		};

		var a = $thread( 'a', function*() {

			yield d();
			return yield b();

		} );

		var b = $thread( 'b', function*() {

			yield d();
			return yield c();

		} );

		var c = $thread( 'c', function*() {

			return checkThread();

		} );

		var d = $thread( 'd', function*() {

			return checkThread();

		} );

		$run( ( function*() {

			return yield a();

		} )() ).then( function() {

			assert.deepEqual( stacks, [ 'a() -> d()', 'a() -> b() -> d()', 'a() -> b() -> c()' ] );
			done();

		} );

	} );

	// jshint esnext: true

	it( 'No Block', function( done ) {

		var x = 0;

		var bill = new CK.threads.Executor( 'bill', {

			step: $thread( 'step', function*( input ) {

				yield this.wait();
				x = 1;
				return input;

			} )

		} );

		var dave = {};

		// Function not called with anything
		$thread( 'main', function*() {

			yield bill.step( 4 );
			assert.equal( x, 0 );
			done();

		} ).call( dave );

	} );

	// jshint esnext: true
	it( 'Block', function( done ) {

		var x = 0;

		var bob = new CK.threads.Executor( 'bob', {

			step: $thread( 'step', function*( input ) {

				yield this.wait();
				x = 1;
				return input;

			} )

		} );

		$thread( 'main', function*() {

			yield this.step( 5 );
			assert.equal( x, 1 );
			done();

		} ).call( bob );

	} );

	// jshint esnext: true
	it( 'Wait for block', function( done ) {

		var x = 0;

		var steve = new CK.threads.Executor( 'steve', {

			step: $thread( 'step', function*( input ) {

				yield this.wait();
				x = 1;
				return input;

			} )

		} );

		var alan = {

			name: 'alan'

		};

		$thread( 'main', function*() {

			var steveThread = yield steve.step( 10 );
			var stepOutput = yield CK.api.waitFor( steveThread );
			assert.equal( stepOutput, 10 );
			assert.equal( x, 1 );
			done();

		} ).call( alan );

	} );

	// jshint esnext: true
	it( 'Block hierarchy', function( done ) {

		var x = 0;

		var dan = new CK.threads.Executor( 'dan', {

			otherFn: $thread( 'otherFn', function*( input ) {

				return ( yield this.step( input ) ) + ( yield this.step( input ) );

			} ),

			step: $thread( 'step', function*( input ) {

				yield this.wait();
				x = 1;
				return input;

			} )

		} );

		$thread( 'main', function*() {

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
			assert.equal( _.last( CK.threads.stack ).trace(), trace );

		};

		var greg = new CK.threads.Executor( 'greg', {

			otherFunction: $thread( 'otherFunction', function*( input ) {

				assertThread( 'greg: main() -> otherFunction(10)' );
				return this.blockingFunction( input );

			} ),

			blockingFunction: $thread( 'blockingFunction', function*( input ) {

				assertThread( 'greg: main() -> otherFunction(10) -> blockingFunction(10)' );
				yield this.wait();
				return input;

			} )

		} );

		var tim = new CK.threads.Executor( 'tim', {

			otherFunction: $thread( 'otherFunction', function*( input ) {

				assertThread( 'greg: main() ==> tim: otherFunction(10)' );
				return this.blockingFunction( input );

			} ),

			blockingFunction: $thread( 'blockingFunction', function*( input ) {

				assertThread( 'greg: main() ==> tim: otherFunction(10) -> blockingFunction(10)' );
				yield this.wait();
				return input;

			} )

		} );

		$thread( 'main', function*() {

			yield this.otherFunction( 10 );
			assertThread( 'greg: main()' );

			var z = yield tim.otherFunction( 10 );

			yield tim.otherFunction( 10 );
			assertThread( 'greg: main()' );

			yield CK.api.waitFor( z );
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
			assert.equal( _.last( CK.threads.stack ).trace(), trace );

		};

		var simpleExecutor = new CK.threads.Executor( 'simpleExecutor', {

			otherFunction: $thread( 'otherFunction', function*( input ) {

				assertThread( 'simpleExecutor: main() -> otherFunction(10)' );
				return this.blockingFunction( input );

			} ),

			blockingFunction: $thread( 'blockingFunction', function*( input ) {

				yield CK.api.wait();
				return input;

			} ),

			afterFunction: $thread( 'afterFunction', function*( inputA, inputB ) {

				assertThread( 'simpleExecutor: main() -> afterFunction(10, blockingFunction)' );
				var outputB = yield inputB.call( this, 10 );
				var outputC = yield inputB( 10 );
				return inputA + outputB + ( yield CK.api.waitFor( outputC ) );

			} ),

		} );

		$thread( 'main', function*() {

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

		var threadA = $thread( 'main', function*() {

			yield CK.api.wait();
			// TODO WARN IF YOU WAIT ON YOURSELF
			var result = yield CK.api.waitFor( threadA );

			assert.equal( result, undefined );

			done();

		} )();

	} );

	// jshint esnext: true 
	it( 'Detect and handle cyclic dependency', function( done ) {

		var threadA = $thread( 'main', function*() {

			yield CK.api.wait();
			var result = yield CK.api.waitFor( threadB );

			assert.equal( result, undefined );

			return 4;

		} )();

		var threadB = $thread( 'main', function*() {

			var result = yield CK.api.waitFor( threadA );

			assert.equal( result, undefined );

			done();

		} )();

	} );

} );


describe( 'Executor', function() {

	beforeEach( function() {

		CK.threads.stack = [];
		CK.threads.waiting = [];

	} );

	// jshint esnext: true 
	it( 'Basic executor', function( done ) {

		var totalDistance = 0;
		var walkers = 0;

		var mate = new CK.threads.Executor( 'mate', {

			walk: $thread( 'walk', function*( input ) {

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

		$thread( 'main', function*() {

			yield mate.walk( 2 );
			yield mate.walk( 4 );
			yield mate.walk( 5 );

			assert.equal( totalDistance, 0 );

			assert.equal( mate.traceThreads(), "thread0: main() ==> mate: walk(2)\nthread1: main() ==> mate: walk(4)\nthread2: main() ==> mate: walk(5)" );
			assert.equal( mate.traceThreads( true ), "thread0: main() ==> mate: walk(2)\nthread1: main() ==> mate: walk(4) <<< [ thread0 ]\nthread2: main() ==> mate: walk(5) <<< [ thread1 ]" );

			yield CK.api.waitFor( mate );

			assert.equal( totalDistance, 11 );

			done();

		} )();

	} );

	// jshint esnext: true 
	it( 'Basic executor can own a thread', function( done ) {

		var totalDistance = 0;
		var walkers = 0;

		var guy = new CK.threads.Executor( 'guy', {

			walk: $thread( 'walk', function*( input ) {

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

		var thread = $thread( 'main', function*() {

			yield this.walk( 2 );
			yield this.walk( 4 );

			// Check that the thread is still active
			assert.equal( this.__thread, thread );

			assert.equal( totalDistance, 6 );

			done();

		} ).call( guy );

	} );

	// jshint esnext: true 
	it( 'Basic executor can block on another thread', function( done ) {

		var totalDistance = 0;
		var walkers = 0;

		var guy = new CK.threads.Executor( 'guy', {

			walkNiall: $thread( 'walk', function*( input ) {

				niall.walk( input );

				yield this.waitFor( niall );

				return input;

			} )

		} );

		var niall = new CK.threads.Executor( 'niall', {

			walk: $thread( 'walk', function*( input ) {

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

		$thread( 'main', function*() {

			var thread = yield guy.walkNiall( 2 );
			yield guy.walkNiall( 4 );

			assert.equal( thread.state, CK.threads.Thread.STATES.WAITING );

			assert.equal( guy.traceThreads( true ), "thread0: main() ==> guy: walk(2) <<< [ * ==> niall: walk(2) ]\nthread1: main() ==> guy: walk(4) <<< [ * ==> niall: walk(4) <<< [ thread0 ==> niall: walk(2) ] ]" );

			yield CK.api.waitFor( guy );

			// Check that no threads are active
			assert.equal( guy.__threads.length, 0 );
			assert.equal( niall.__threads.length, 0 );
			assert.equal( guy.__thread, null );
			assert.equal( niall.__thread, null );

			assert.equal( totalDistance, 6 );

			done();

		} )();

	} );

	// jshint esnext: true 
	it( 'Executor has racing threads that run in order', function( done ) {

		var walkOutput = [];

		var tony = new CK.threads.Executor( 'tony', {

			walk: $thread( 'walk', function*( input ) {

				yield this.waitFor();

				yield this.wait();

				walkOutput.push( input );
				return input;

			} )

		} );

		$thread( 'main0', function*() {

			yield this.walk( 2 );
			yield this.walk( 4 );

		} ).call( tony );

		$thread( 'main1', function*() {

			yield this.walk( 6 );
			yield this.walk( 8 );
			assert.deepEqual( walkOutput, [ 2, 4, 6, 8 ] );
			done();

		} ).call( tony );

	} );

	// jshint esnext: true 
	it( 'Handle blocking correctly when calling functions across each other', function( done ) {

		var walkOutput = [];

		var dick = new CK.threads.Executor( 'dick', {

			walk: $thread( 'walk', function*( input ) {

				yield this.waitFor();
				yield this.wait();

				walkOutput.push( input );
				return input;

			} )

		} );

		var dom = new CK.threads.Executor( 'dom', {

			walk: $thread( 'walk', function*( input ) {

				yield this.waitFor();
				yield this.wait();

				walkOutput.push( input );
				return input;

			} )

		} );

		var threadA = $thread( 'main', function*() {

			yield this.walk( 2 );
			var otherThread = yield dom.walk( 4 );

			var output = yield CK.api.waitFor( otherThread );

			assert.equal( output, 4 );

		} ).call( dick );

		var threadB = $thread( 'main', function*() {

			yield this.walk( 6 );
			var otherThread = yield dick.walk( 8 );

			var output = yield CK.api.waitFor( otherThread );

			assert.equal( output, 8 );

		} ).call( dom );

		Promise.all( [ threadA.promise, threadB.promise ] ).then( function() {

			assert.deepEqual( walkOutput.sort(), [ 2, 4, 6, 8 ] );
			assert.equal( threadA.state, CK.threads.Thread.STATES.FINISHED );
			assert.equal( threadB.state, CK.threads.Thread.STATES.FINISHED );
			done();

		} );

	} );

} );

describe( 'stop', function() {

	beforeEach( function() {

		CK.threads.stack = [];
		CK.threads.waiting = [];

	} );

	// jshint esnext: true 
	it( 'Stop spawned thread', function( done ) {

		var walk = 0;

		var toby = new CK.threads.Executor( 'toby', {

			walk: $thread( 'walk', function*( input ) {

				yield this.waitFor();
				yield this.wait();

				walk = 1;

				return input;

			} )

		} );

		$thread( 'main', function*() {

			yield toby.walk( 2 );
			yield toby.stop();

			yield CK.api.wait();

			assert.equal( walk, 0 );
			done();

		} )();

	} );

	// jshint esnext: true 
	it( 'Waiting on a stopped thread makes you continue', function( done ) {

		var walk = 0;

		var toby = new CK.threads.Executor( 'toby', {

			walk: $thread( 'walk', function*( input ) {

				yield this.waitFor();
				yield this.wait( 10000 );

				walk = 1;

				return input;

			} )

		} );

		$thread( 'main', function*() {

			var thread = yield toby.walk( 2 );

			yield toby.stop();

			yield CK.api.waitFor( thread );

			assert.equal( thread.state, CK.threads.Thread.STATES.STOPPED );

			assert.equal( walk, 0 );
			done();

		} )();

	} );

	// jshint esnext: true 
	it( 'Stop removes all threads from an executor', function( done ) {

		var walk = 0;

		var toby = new CK.threads.Executor( 'toby', {

			walk: $thread( 'walk', function*( input ) {

				yield this.wait();

				walk++;

				return input;

			} )

		} );

		$thread( 'main', function*() {

			yield toby.walk( 2 );
			yield toby.walk( 2 );
			yield toby.walk( 2 );
			yield toby.walk( 2 );

			yield toby.stop();

			yield CK.api.wait();

			assert.equal( walk, 0 );
			done();

		} )();

	} );

	// jshint esnext: true 
	it( 'You can stop yourself', function( done ) {

		var walk = 0;

		$thread( 'main', function*() {

			yield CK.threads.active.stop();

			walk = 1;

		} )().promise.catch( function() {

			assert.equal( walk, 0 );
			done();

		} );

	} );

} );

describe( 'pause', function() {

	beforeEach( function() {

		CK.threads.stack = [];
		CK.threads.waiting = [];

	} );

	// jshint esnext: true 
	it( 'Pause and resume a thread', function( done ) {

		var walk = 0;

		var toby = new CK.threads.Executor( 'toby', {

			walk: $thread( 'walk', function*() {

				yield this.wait();

				walk = 1;

			} )

		} );

		$thread( 'main', function*() {

			var thread = yield toby.walk( 2 );

			yield thread.pause();

			yield CK.api.wait();

			assert.equal( walk, 0 );

			yield thread.resume();

			yield CK.api.waitFor( thread );

			assert.equal( walk, 1 );

			done();


		} )();

	} );

	// jshint esnext: true 
	it( 'Pause and resume an executor', function( done ) {

		var walk = 0;

		var toby = new CK.threads.Executor( 'toby', {

			walk: $thread( 'walk', function*() {

				yield this.wait();

				walk = 1;

			} )

		} );

		$thread( 'main', function*() {

			yield toby.pause();

			var thread = yield toby.walk( 2 );

			yield CK.api.wait();

			assert( thread.paused );

			assert.equal( walk, 0 );

			yield toby.resume();

			assert( !thread.paused );

			yield CK.api.waitFor( thread );

			assert.equal( walk, 1 );

			done();


		} )();

	} );


} );

describe( 'Exception handling', function() {

	beforeEach( function() {

		CK.threads.stack = [];
		CK.threads.waiting = [];

	} );

	// jshint esnext: true 
	it( 'Catch an exception from a thread', function( done ) {

		var toby = new CK.threads.Executor( 'toby', {

			walk: $thread( 'walk', function*() {

				yield this.waitFor();
				yield this.wait();

				throw new Error( 'Whoops.' );

			} )

		} );

		$thread( 'main', function*() {

			var thread = yield toby.walk( 2 );

			yield thread.error( function( error ) {

				assert.equal( error.message, 'Whoops.' );
				done();

			} );

		} )();

	} );

	// jshint esnext: true 
	it( 'Catch an exception from stopping a thread', function( done ) {

		var willbert = new CK.threads.Executor( 'willbert', {

			walk: $thread( 'walk', function*() {

				yield this.waitFor();
				yield this.wait();

			} )

		} );

		$thread( 'main', function*() {

			var thread = yield willbert.walk( 2 );

			yield thread.error( function( error ) {

				assert.equal( error.message, 'InterruptedException' );
				done();

			} );

			yield thread.stop();

		} )();

	} );

	// jshint esnext: true 
	it( 'You can catch interrupted exception if you are stopped', function( done ) {

		var walk = 0;

		var tom = new CK.threads.Executor( 'tom', {

			walk: $thread( 'walk', function*( input ) {

				try {

					yield this.wait();

					walk = 2;

				} catch ( e ) {

					walk = 1;

				}

				return input;

			} )

		} );

		$thread( 'main', function*() {

			var thread = yield tom.walk( 2 );
			yield tom.stop();

			yield CK.api.waitFor( thread );

			assert.equal( walk, 1 );
			done();

		} )();

	} );

	// jshint esnext: true 
	it( 'You can catch a waiting exception', function( done ) {

		$thread( 'main', function*() {

			try {

				yield CK.threads.promise( 'dude', function( fulfil, fail ) {

					fail( new Error( 'glitch fell over' ) );

				} );

			} catch ( error ) {

				assert.equal( error.message, 'glitch fell over' );
				done();

			}

		} )();

	} );

	// jshint esnext: true 
	it( 'You can catch an exception that is thrown', function( done ) {

		var thread = $thread( 'main', function*() {

			try {

				yield CK.api.wait();

			} catch ( error ) {

				assert.equal( error.message, 'haha that' );
				done();

			}

		} )();

		thread.throw( new Error( 'haha that' ) );

	} );

} );


describe( 'Thread binding', function() {

	beforeEach( function() {

		CK.threads.stack = [];
		CK.threads.waiting = [];

	} );

	// jshint esnext: true 
	it( 'You can listen to the result of a future thread event', function( done ) {

		var tom = new CK.threads.Executor( 'tom', {

			walk: $thread( 'walk', function*( input ) {

				yield CK.api.wait();

				return input;

			} )

		} );

		$thread( 'main', function*() {

			var output = yield CK.api.waitOn( tom.walk );

			assert.equal( output, 6 );
			done();

		} )();

		tom.walk( 6 );

	} );

	// jshint esnext: true 
	it( 'You can catch a dead exception', function( done ) {

		var tom = new CK.threads.Executor( 'tom', {

			walk: $thread( 'walk', function*( input ) {

				yield CK.api.wait();

				return input;

			} )

		} );

		$thread( 'main', function*() {

			try {

				yield CK.api.waitOn( tom.walk );

			} catch ( error ) {

				assert.equal( error.message, 'ExpiredExecutorException' );
				done();

			}


		} )();

		tom.die();

	} );

} );