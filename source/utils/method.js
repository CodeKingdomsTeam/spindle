'use strict';

var _ = require( 'lodash' );
var babel = require( 'babel-core' );

module.exports = function( spindle ) {

	_.extend( spindle, {

		method: function( fnOrString, schema ) {

			var string;
			var name = 'fn';

			// Calculate the name of the function and its string representation
			if ( _.isString( fnOrString ) ) {

				string = fnOrString;

				// Match the name of the function
				var nameMatch = fnOrString.match( /^function\s([^(]+)/ );

				if ( nameMatch ) {

					name = nameMatch[ 1 ];

				}

			} else {

				string = fnOrString.toString();
				name = fnOrString.name || name;

			}

			if ( _.isObject( schema ) ) {

				name = schema.name || 'fn';

			}

			var prefix = string.match( /[^(]+/ )[ 0 ];

			// Ensure the function is named so that acorn can parse it
			var namedString = 'function ' + name + string.substring( prefix.length );

			// Use strict for the compiled function
			var PREAMBLE = "'use strict';\nvar spindle = this;\n";

			var output = spindle.translate( spindle.parse( namedString ) );

			// Try creating the function with generators
			var compiledFunction;

			try {

				compiledFunction = new Function( PREAMBLE + 'return ' + output ).call( spindle );

			} catch ( e ) {

				console.log( e.stack );

				try {

					// If generators are not supported then use babel to translate them
					/* global babel: true */
					output = babel.transform( output, spindle.babelOptions );
					output = PREAMBLE + 'return ' + output.code.substring( PREAMBLE.length );
					compiledFunction = new Function( output ).call( spindle );

				} catch ( e2 ) {

					spindle.console.warn( "Bad function " + name, e2 );
					return function() {};

				}

			}

			if ( schema ) {

				compiledFunction.__schema = schema;

			}

			compiledFunction.compiled = true;

			return compiledFunction;

		}

	} );

};