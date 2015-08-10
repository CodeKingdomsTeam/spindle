'use strict';

global.acorn = require( 'acorn' );
global._ = require( 'lodash' );
global.Promise = require( 'bluebird' );

var assert = require( 'chai' ).assert;

global.CK = {
	threads: {}
};
require( '../../source/game/threads/Threads.js' );
require( '../../source/game/threads/ThreadConverter.js' );
require( '../../source/game/threads/VariableWalker.js' );

var test = function( fn, expected ) {

	var output = CK.threads.translate( CK.threads.parse( "function my_" + fn.toString() ) );

	var stringA = output.replace( /[\s]/g, '' );
	var stringB = 'CK.threads.$thread("my_function",' + expected.toString().replace( /[\s]/g, '' ) + ');';

	if ( stringA !== stringB ) {

		console.log( stringA );
		console.log( stringB );

	}

	assert.equal( stringA, stringB );

};

describe( 'Javascript Converting', function() {

	beforeEach( function() {

	} );

	// jshint esnext: true 
	it( 'Blank function', function() {

		test( function() {}, function*() {} );

	} );

	// jshint esnext: true 
	it( 'Simple maths expression', function() {

		test( function() {

			var x = -2 + 3 + 4;

		}, function*() {

			var x = ( ( ( -2 ) + 3 ) + 4 );

		} );

	} );

	// jshint esnext: true 
	it( 'Simple logical expression', function() {

		test( function() {

			var x = x && !x || ( 4 > 3 ? x : x );

		}, function*() {

			var x = ( ( x && ( !x ) ) || ( CK.api.__compare( 4, 3, ">" ) ? x : x ) );

		} );

	} );

	// jshint esnext: true 
	it( 'Member expression', function() {

		test( function() {

			var x = x.y.z;

		}, function*() {

			var x = x.y.z;

		} );

	} );

	// jshint esnext: true 
	it( 'Simple update expressions', function() {

		test( function() {

			var x = 'hello';
			x++;
			x += 5;
			x = 2;

		}, function*() {

			var x = 'hello';
			( x++ );
			( x += 5 );
			( x = 2 );

		} );

	} );

	// jshint esnext: true 
	it( 'Simple while loop', function() {

		test( function() {

			var x = 0;

			while ( true ) {
				x++;
			}

		}, function*() {

			var x = 0;

			while ( true ) {
				( x++ );
			}

		} );

	} );

	// jshint esnext: true 
	it( 'Simple control flow', function() {

		test( function() {

			var x = 0;

			while ( x ) {

				if ( x == 4 ) {

					x++;

				} else {

					if ( x ) {

						for ( var i = 0; i < 3; i++ ) {

							for ( var j in x ) {

								x--;

							}

						}

					}

				}
			}

		}, function*() {

			var x = 0;

			while ( x ) {

				if ( CK.api.__compare( x, 4, "==" ) ) {

					( x++ );

				} else {

					if ( x ) {

						for ( var i = 0; CK.api.__compare( i, 3, "<" );
							( i++ ) ) {

							for ( var j in x ) {

								( x-- );

							}

						}

					}

				}
			}

		} );

	} );

} );

describe( 'Threads', function() {

	// jshint esnext: true 
	it( 'Named function', function() {

		test( function() {

			function onPress() {

				var x = 2;

			}


		}, function*() {

			CK.threads.$thread( "onPress", function*() {

				var x = 2;

			} );


		} );

	} );

	// jshint esnext: true 
	it( 'Anonymous function', function() {

		test( function() {

			var onPress = function() {

				var x = 2;

			}


		}, function*() {

			var onPress = CK.threads.$thread( "function", function*() {

				var x = 2;

			} );


		} );

	} );

	// jshint esnext: true 
	it( 'Anonymous function with arguments', function() {

		test( function() {

			var onPress = function( a, b, c ) {

				return a + b + c;

			}


		}, function*() {

			var onPress = CK.threads.$thread( "function", function*( a, b, c ) {

				return ( ( a + b ) + c );

			} );


		} );

	} );

	// jshint esnext: true 
	it( 'Function call', function() {

		test( function() {

			var x = 0;

			x( 5 );

		}, function*() {

			var x = 0;

			yield x( 5 );

		} );

	} );

	// jshint esnext: true 
	it( 'Member call', function() {

		test( function() {

			var x = 0;

			x.tread( 5 );

		}, function*() {

			var x = 0;

			yield x.tread( 5 );

		} );

	} );

} );

describe( 'Global api mappings', function() {

	// jshint esnext: true 
	it( 'Simple global references', function() {

		test( function() {

			var x = wait;
			waitFor( 5 );
			x( 5 );

		}, function*() {

			var x = CK.api.wait;
			yield CK.api.waitFor( 5 );
			yield x( 5 );

		} );

	} );

	// jshint esnext: true 
	it( 'Function closure references', function() {

		test( function() {

			var x = wait;
			waitFor( 5 );
			x( 5 );
			y = 3;

			function test( y ) {

				y = 2;

				return x + y + z;

			}

			y = x + 4 + z;

		}, function*() {

			var x = CK.api.wait;
			yield CK.api.waitFor( 5 );
			yield x( 5 );
			( CK.api.y = 3 );

			CK.threads.$thread( "test", function*( y ) {

				( y = 2 );
				return ( ( x + y ) + CK.api.z );

			} );

			( CK.api.y = ( ( x + 4 ) + CK.api.z ) );

		} );

	} );

	// jshint esnext: true 
	it( 'Anonymous function closure references', function() {

		test( function() {

			var x = wait;
			waitFor( 5 );
			x( 5 );
			y = 3;

			var test = function( y ) {

				y = 2;

				var test2 = function( z ) {

					return y + z;

				};

				z = 4;

				var test3 = function( z ) {

					return x + a;

				};

				return x + y + z;

			};

			z = x + 4 + z;

		}, function*() {

			var x = CK.api.wait;
			yield CK.api.waitFor( 5 );
			yield x( 5 );
			( CK.api.y = 3 );

			var test = CK.threads.$thread( "function", function*( y ) {

				( y = 2 );

				var test2 = CK.threads.$thread( "function", function*( z ) {

					return ( y + z );

				} );

				( CK.api.z = 4 );

				var test3 = CK.threads.$thread( "function", function*( z ) {

					return ( x + CK.api.a );

				} );

				return ( ( x + y ) + CK.api.z );

			} );

			( CK.api.z = ( ( x + 4 ) + CK.api.z ) );

		} );

	} );

} );