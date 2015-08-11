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

describe( 'Thread binding', function() {

	beforeEach( function() {

		spindle.stack = [];
		spindle.waiting = [];

	} );


	it( 'You can listen to the result of a future thread event', function( done ) {

		var tom = new spindle.Executor( 'tom', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield spindle.api.wait();

				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			var output = yield spindle.api.waitOn( tom.walk );

			assert.equal( output, 6 );
			done();

		} )();

		tom.walk( 6 );

	} );


	it( 'You can catch a dead exception', function( done ) {

		var tom = new spindle.Executor( 'tom', {

			walk: spindle.thread( 'walk', function*( input ) {

				yield spindle.api.wait();

				return input;

			} )

		} );

		spindle.thread( 'main', function*() {

			try {

				yield spindle.api.waitOn( tom.walk );

			} catch ( error ) {

				assert.equal( error.message, 'ExpiredExecutorException' );
				done();

			}


		} )();

		tom.die();

	} );

} );