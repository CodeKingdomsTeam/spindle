'use strict';

var _ = require( 'lodash' );

module.exports = function( spindle ) {

	_.extend( spindle.api, {

		__compare: function( left, right, operation ) {

			var result, overridden = false;

			if ( left && left.__compare ) {

				overridden = true;
				result = left.__compare( right );


			} else if ( right && right.__compare && inverse[ operation ] ) {

				overridden = true;
				operation = inverse[ operation ];
				result = right.__compare( left );

			}

			if ( overridden ) {

				// Unsupported comparison
				if ( result === undefined ) return false;

				if ( ops[ operation ] ) {

					return ops[ operation ]( result );

				} else {

					spindle.console.warn( '__compare called with unsupported comparison operator', operation );

				}

			}

			// If there is no rich __compare method or left is falsy then run a normal comparison
			switch ( operation ) {

				case '==':
					return left == right;
				case '===':
					return left === right;
				case '!=':
					return left != right;
				case '!==':
					return left !== right;
				case '<':
					return left < right;
				case '>':
					console.log( left, right );
					return left > right;
				case '<=':
					return left <= right;
				case '>=':
					return left >= right;
				default:
					spindle.console.warn( 'Unsupported comparison operator that needs to be implemented here', operation );
					return;
			}
		}

	} );

	var ops = spindle.api.__compare.OPERATORS = {

		'==': function( result ) {

			return result === 0;
		},

		'!=': function( result ) {

			return result !== 0;
		},

		'<': function( result ) {

			return result < 0;
		},

		'>': function( result ) {

			return result > 0;
		},

		'<=': function( result ) {

			return result <= 0;
		},

		'>=': function( result ) {

			return result >= 0;
		}

	};

	var inverse = spindle.api.__compare.INVERSE_OPERATIONS = {
		'<': '>',
		'>': '<',
		'>=': '<=',
		'<=': '>=',
		'==': '==',
		'===': '===',
		'!==': '!==',
		'!=': '!='
	};

	ops[ '===' ] = ops[ '==' ];
	ops[ '!==' ] = ops[ '!=' ];

};