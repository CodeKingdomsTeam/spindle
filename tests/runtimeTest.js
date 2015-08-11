'use strict';

var spindle = require( '../source/index.js' )();
var _ = require( 'lodash' );

var assert = require( 'chai' ).assert;

var passThrough = function( number ) {

	return spindle.promise( 'passThrough', function( fulfil ) {

		fulfil( number );

	} );

};

describe( 'run', function() {

	beforeEach( function() {

	} );

	// jshint esnext: true 
	it( 'Basic run', function( done ) {

		spindle.run( ( function*() {

			yield 2;
			return 3;

		} )() ).then( function( result ) {

			assert.equal( result, 3 );
			done();


		} );

	} );

	// jshint esnext: true 
	it( 'Pass through', function( done ) {

		spindle.run( ( function*() {

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

		spindle.run( ( function*() {

			return ( yield passThrough( 2 ) ) + ( yield simpleReturn( 3 ) );

		} )() ).then( function( result ) {

			assert.equal( result, 5 );
			done();


		} );

	} );


	// jshint esnext: true 
	it( 'Loop body', function( done ) {

		spindle.run( ( function*() {

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

		spindle.run( ( function*() {

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