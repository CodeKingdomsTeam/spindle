'use strict';

var spindle = require( '../source/index.js' )();
var _ = require( 'lodash' );

var assert = require( 'chai' ).assert;

describe( '__compare', function() {

	// jshint esnext: true 
	it( 'Basic __compare without override', function( done ) {

		spindle.method( function( assert, done ) {

			assert( 2 < 3 );
			assert( 5 >= 5 );
			assert( 5 >= 4 );
			assert( 0 !== false );
			assert( true === true );
			assert( 1 == true );
			done();

		} )( assert, done );

	} );

	// jshint esnext: true 
	it( 'Object that defines a custom __compare', function( done ) {

		var objectX = {
			__compare: function( y ) {

				return this.weight - y.weight;

			},
			weight: 3
		};

		var objectY = {
			weight: 5
		};

		spindle.method( function( assert, done, x, y ) {

			assert( x < y );
			assert( x !== y );
			done();

		} )( assert, done, objectX, objectY );

	} );

	// jshint esnext: true 
	it( 'Object that defines a custom __compare using inverse', function( done ) {

		var objectX = {
			__compare: function( y ) {

				return this.weight - y.weight;

			},
			weight: 3
		};

		var objectY = {
			weight: 5
		};

		spindle.method( function( assert, done, x, y ) {

			assert( y > x );
			assert( y !== x );
			done();

		} )( assert, done, objectX, objectY );

	} );

} );