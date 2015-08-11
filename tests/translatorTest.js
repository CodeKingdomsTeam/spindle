'use strict';

var spindle = require( '../source/index.js' )();
var _ = require( 'lodash' );
var assert = require( 'chai' ).assert;

var assertFn = function( fn, expected ) {

	var output = spindle.translate( spindle.parse( "function my_" + fn.toString() ) );

	var stringA = output.replace( /[\s]/g, '' );
	var stringB = 'spindle.thread("my_function",' + expected.toString().replace( /[\s]/g, '' ) + ');';

	if ( stringA !== stringB ) {

		spindle.console.log( stringA );
		spindle.console.log( stringB );

	}

	assert.equal( stringA, stringB );

};

describe( 'Javascript translation', function() {

	beforeEach( function() {

	} );


	it( 'Blank function', function() {

		assertFn( function() {}, function*() {} );

	} );


	it( 'Simple maths expression', function() {

		assertFn( function() {

			var x = -2 + 3 + 4;

		}, function*() {

			var x = ( ( ( -2 ) + 3 ) + 4 );

		} );

	} );


	it( 'Simple logical expression', function() {

		assertFn( function() {

			var x = x && !x || ( 4 > 3 ? x : x );

		}, function*() {

			var x = ( ( x && ( !x ) ) || ( spindle.api.__compare( 4, 3, ">" ) ? x : x ) );

		} );

	} );


	it( 'Member expression', function() {

		assertFn( function() {

			var x = x.y.z;

		}, function*() {

			var x = x.y.z;

		} );

	} );


	it( 'Simple update expressions', function() {

		assertFn( function() {

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


	it( 'Simple while loop', function() {

		assertFn( function() {

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


	it( 'Simple control flow', function() {

		assertFn( function() {

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

				if ( spindle.api.__compare( x, 4, "==" ) ) {

					( x++ );

				} else {

					if ( x ) {

						for ( var i = 0; spindle.api.__compare( i, 3, "<" );
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


	it( 'Named function', function() {

		assertFn( function() {

			function onPress() {

				var x = 2;

			}


		}, function*() {

			spindle.thread( "onPress", function*() {

				var x = 2;

			} );


		} );

	} );


	it( 'Anonymous function', function() {

		assertFn( function() {

			var onPress = function() {

				var x = 2;

			}


		}, function*() {

			var onPress = spindle.thread( "function", function*() {

				var x = 2;

			} );


		} );

	} );


	it( 'Anonymous function with arguments', function() {

		assertFn( function() {

			var onPress = function( a, b, c ) {

				return a + b + c;

			}


		}, function*() {

			var onPress = spindle.thread( "function", function*( a, b, c ) {

				return ( ( a + b ) + c );

			} );


		} );

	} );


	it( 'Function call', function() {

		assertFn( function() {

			var x = 0;

			x( 5 );

		}, function*() {

			var x = 0;

			( yield x( 5 ) );

		} );

	} );


	it( 'Member call', function() {

		assertFn( function() {

			var x = 0;

			x.tread( 5 );

		}, function*() {

			var x = 0;

			( yield x.tread( 5 ) );

		} );

	} );

} );

describe( 'Global api mappings', function() {


	it( 'Simple global references', function() {

		assertFn( function() {

			var x = wait;
			waitFor( 5 );
			x( 5 );

		}, function*() {

			var x = spindle.api.wait;
			( yield spindle.api.waitFor( 5 ) );
			( yield x( 5 ) );

		} );

	} );


	it( 'Function closure references', function() {

		assertFn( function() {

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

			var x = spindle.api.wait;
			( yield spindle.api.waitFor( 5 ) );
			( yield x( 5 ) );
			( spindle.api.y = 3 );

			spindle.thread( "test", function*( y ) {

				( y = 2 );
				return ( ( x + y ) + spindle.api.z );

			} );

			( spindle.api.y = ( ( x + 4 ) + spindle.api.z ) );

		} );

	} );


	it( 'Anonymous function closure references', function() {

		assertFn( function() {

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

			var x = spindle.api.wait;
			( yield spindle.api.waitFor( 5 ) );
			( yield x( 5 ) );
			( spindle.api.y = 3 );

			var test = spindle.thread( "function", function*( y ) {

				( y = 2 );

				var test2 = spindle.thread( "function", function*( z ) {

					return ( y + z );

				} );

				( spindle.api.z = 4 );

				var test3 = spindle.thread( "function", function*( z ) {

					return ( x + spindle.api.a );

				} );

				return ( ( x + y ) + spindle.api.z );

			} );

			( spindle.api.z = ( ( x + 4 ) + spindle.api.z ) );

		} );

	} );

} );