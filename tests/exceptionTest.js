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

describe( 'Exception handling', function() {

	beforeEach( function() {

		spindle.stack = [];
		spindle.waiting = [];

	} );


	it( 'Catch an exception from a thread', function( done ) {

		var toby = new spindle.Executor( 'toby', {

			walk: spindle.thread( 'walk', function*() {

				yield this.waitFor();
				yield this.wait();

				throw new Error( 'Whoops.' );

			} )

		} );

		spindle.thread( 'main', function*() {

			var thread = yield toby.walk( 2 );

			yield thread.error( function( error ) {

				assert.equal( error.message, 'Whoops.' );
				done();

			} );

		} )();

	} );


	it( 'Catch an exception from stopping a thread', function( done ) {

		var willbert = new spindle.Executor( 'willbert', {

			walk: spindle.thread( 'walk', function*() {

				yield this.waitFor();
				yield this.wait();

			} )

		} );

		spindle.thread( 'main', function*() {

			var thread = yield willbert.walk( 2 );

			yield thread.error( function( error ) {

				assert.equal( error.message, 'InterruptedException' );
				done();

			} );

			yield thread.stop();

		} )();

	} );


	it( 'You can catch interrupted exception if you are stopped', function( done ) {

		var walk = 0;

		var tom = new spindle.Executor( 'tom', {

			walk: spindle.thread( 'walk', function*( input ) {

				try {

					yield this.wait();

					walk = 2;

				} catch ( e ) {

					walk = 1;

				}

				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			var thread = yield tom.walk( 2 );
			yield tom.stop();

			yield spindle.api.waitFor( thread );

			assert.equal( walk, 1 );
			done();

		} )();

	} );


	it( 'You can catch a waiting exception', function( done ) {

		spindle.thread( 'main', function*() {

			try {

				yield spindle.promise( 'dude', function( fulfil, fail ) {

					fail( new Error( 'glitch fell over' ) );

				} );

			} catch ( error ) {

				assert.equal( error.message, 'glitch fell over' );
				done();

			}

		} )();

	} );


	it( 'You can catch an exception that is thrown', function( done ) {

		var thread = spindle.thread( 'main', function*() {

			try {

				yield spindle.api.wait();

			} catch ( error ) {

				assert.equal( error.message, 'haha that' );
				done();

			}

		} )();

		thread.throw( new Error( 'haha that' ) );

	} );

} );