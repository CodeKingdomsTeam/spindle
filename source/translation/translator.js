'use strict';

var _ = require( 'lodash' );

module.exports = function( spindle ) {

	var API_ROOT = spindle.apiRoot;

	var notImplemented = function( node ) {
		spindle.console.warn( "Not yet implemented for node", node );
		return '';
	};

	var walk = function( node, tabOffset ) {

		if ( !node ) throw new Error( 'missing node' );

		var handler = translationHandlers[ node.type ];

		if ( !handler ) throw new Error( node.type + ' has no handler' );

		var output = handler( node, tabOffset );

		if ( !_.isString( output ) ) throw new Error( node.type + ' not returning a string' );

		return output;

	};

	var variableTable = {};

	spindle.translate = function( parseTree, tabOffset ) {

		if ( !parseTree ) return;

		variableTable = {};

		return walk( parseTree, tabOffset || '' );

	};

	var isAlphanumeric = function( text ) {
		return !!text.match( /^[A-Za-z0-9]+$/ );
	};

	var translationHandlers = {

		BlockStatement: function( node, tabOffset ) {

			var text = '';

			for ( var i in node.body ) {

				text += tabOffset + walk( node.body[ i ], tabOffset );
				text += "\n";

			}

			return text;

		},

		ExpressionStatement: function( node, tabOffset ) {

			return walk( node.expression, tabOffset ) + ';';

		},

		IfStatement: function( node, tabOffset ) {

			var text = '';
			text += "\n" + tabOffset;
			text += 'if ( ';
			text += walk( node.test, tabOffset );
			text += ' ) {';
			text += "\n";
			text += "\n";

			text += walk( node.consequent, tabOffset + "\t" );

			if ( node.alternate ) {

				text += "\n";
				text += "} else {";
				text += "\n";
				text += walk( node.alternate, tabOffset + "\t" );

			}

			text += "\n" + tabOffset;
			text += "}";
			text += "\n";

			return text;

		},

		LabeledStatement: notImplemented,

		BreakStatement: function() {

			return 'break;';

		},

		ContinueStatement: function() {

			return 'continue;';

		},

		DebuggerStatement: function() {

			return 'debugger;';

		},

		SwitchStatement: notImplemented,

		ReturnStatement: function( node, tabOffset ) {

			var text = 'return';

			if ( node.argument ) {

				text += ' ' + walk( node.argument, tabOffset );

			}

			text += ';';
			return text;

		},

		ThrowStatement: notImplemented,
		TryStatement: notImplemented,

		WhileStatement: function( node, tabOffset ) {

			var text = '';
			text += "\n" + tabOffset;
			text += 'while ( ';
			text += walk( node.test, tabOffset );
			text += ' ) {';
			text += "\n";
			text += "\n";

			text += walk( node.body, tabOffset + "\t" );

			text += "\n" + tabOffset;
			text += "}";
			text += "\n";

			return text;

		},

		RepeatStatement: notImplemented,

		ForStatement: function( node, tabOffset ) {

			var text = '';
			text += "\n" + tabOffset;
			text += 'for ( ';
			text += walk( node.init, tabOffset );
			text += ' ';
			text += walk( node.test, tabOffset );
			text += '; ';
			text += walk( node.update, tabOffset );
			text += ' ) {';
			text += "\n";
			text += "\n";

			text += walk( node.body, tabOffset + "\t" );

			text += "\n" + tabOffset;
			text += "\n";
			text += "}";

			return text;

		},
		ForInStatement: function( node, tabOffset ) {

			var left = walk( node.left, tabOffset );

			if ( _.endsWith( left, ';' ) ) left = left.substring( 0, left.length - 2 );

			var text = '';
			text += "\n" + tabOffset;
			text += 'for ( ';
			text += left;
			text += ' in ';
			text += walk( node.right, tabOffset );
			text += ' ) {';
			text += "\n";
			text += "\n";

			text += walk( node.body, tabOffset + "\t" );

			text += "\n" + tabOffset;
			text += "}";
			text += "\n";

			return text;

		},

		ForInit: notImplemented,
		VariableDeclaration: function( node, tabOffset ) {

			var text = 'var ';
			var declarations = [];

			if ( node.kind !== 'var' ) {

				throw "Declaration type " + node.kind + " not supported";

			} else {

				for ( var i in node.declarations ) {
					var decl = node.declarations[ i ];

					if ( decl.init ) {

						declarations.push( decl.id.name + ' = ' + walk( decl.init, tabOffset ) );

					} else {

						declarations.push( decl.id.name + ';' );

					}

				}
			}

			text += declarations.join( ', ' );
			text += ';';

			return text;

		},

		FunctionDeclaration: function( node, tabOffset ) {

			// Get variables
			var variables = spindle.variablesForFunctionNode( node );
			_.each( variables, function( variable ) {

				if ( !variableTable[ variable ] ) {

					variableTable[ variable ] = node;

				}

			} );

			var text = '';

			text += 'spindle.thread("' + node.id.name + '", ';
			text += 'function*(';

			if ( node.params.length ) {

				text += ' ';

				var parameters = node.params.map( function( param ) {

					return param.name;

				} ).join( ', ' );

				text += parameters;
				text += ' ) {';

			} else {

				text += ') {';

			}

			text += "\n";
			text += "\n";

			text += translationHandlers.BlockStatement( node.body, tabOffset + "\t" );

			text += "\n";
			text += tabOffset + '});';

			// Remove variables from table
			_.each( variableTable, function( n, variable ) {

				if ( variableTable[ variable ] === node ) {

					delete variableTable[ variable ];

				}

			} );

			return text;

		},

		Function: notImplemented,
		ScopeBody: notImplemented,

		Expression: function( node, tabOffset ) {
			return walk( node.expression, tabOffset );
		},

		ThisExpression: function( node, tabOffset ) {
			return 'this';
		},

		ArrayExpression: function( node, tabOffset ) {

			if ( node.elements.length ) {

				var text = '[ ';
				for ( var i in node.elements ) {
					text += walk( node.elements[ i ], tabOffset ) + ', ';
				}
				text = text.substring( 0, text.length - 1 ) + ' ]';

				return text;

			} else {
				return '[]';
			}

		},

		ObjectExpression: function( node, tabOffset ) {

			var text = '{';
			var properties = [];

			for ( var i in node.properties ) {

				var property = node.properties[ i ];

				var propertyName = property.key.name;
				if ( propertyName === undefined ) propertyName = property.key.raw;

				properties.push( propertyName + ':' + walk( property.value, tabOffset ) );
			}

			text += properties.join( ",\n" + tabOffset );

			text = "\n" + tabOffset + '}';

			return text;

		},

		FunctionExpression: function( node, tabOffset ) {

			// Get variables
			var variables = spindle.variablesForFunctionNode( node );

			_.each( variables, function( variable ) {

				if ( !variableTable[ variable ] ) {

					variableTable[ variable ] = node;

				}

			} );

			var text = '';
			text += 'spindle.thread("function", ';
			text += 'function*( ';

			var parameters = node.params.map( function( param ) {

				return param.name;

			} ).join( ', ' );

			text += parameters;
			text += ' ) {';
			text += "\n";
			text += "\n";

			text += translationHandlers.BlockStatement( node.body, tabOffset + "\t" );

			text += "\n";
			text += tabOffset + '})';

			// Remove variables from table
			_.each( variableTable, function( n, variable ) {

				if ( variableTable[ variable ] === node ) {

					delete variableTable[ variable ];

				}

			} );

			return text;

		},

		CallExpression: function( node, tabOffset ) {

			var text = 'yield ';
			text += walk( node.callee, tabOffset );
			text += '( ';

			var parameters = node.arguments.map( function( arg ) {

				return walk( arg, tabOffset );

			} ).join( ', ' );

			text += parameters;
			text += ' )';

			return text;
		},

		SequenceExpression: notImplemented,

		AssignmentExpression: function( node, tabOffset ) {

			return '( ' + walk( node.left, tabOffset ) + ' ' + node.operator + ' ' + walk( node.right, tabOffset ) + ' )';

		},
		UpdateExpression: function( node, tabOffset ) {

			if ( node.prefix ) {
				return '(' + node.operator + ' ' + walk( node.argument, tabOffset ) + ')';
			} else {
				return '(' + walk( node.argument, tabOffset ) + node.operator + ')';
			}
		},
		LogicalExpression: function( node, tabOffset ) {

			return '(' + walk( node.left, tabOffset ) + node.operator + walk( node.right, tabOffset ) + ')';

		},

		UnaryExpression: function( node, tabOffset ) {

			if ( node.prefix ) {

				return '( ' + node.operator + ( isAlphanumeric( node.operator ) ? ' ' : '' ) + walk( node.argument, tabOffset ) + ' )';

			} else {

				return '( ' + walk( node.argument, tabOffset ) + ( isAlphanumeric( node.operator ) ? ' ' : '' ) + node.operator + ' )';

			}

		},

		BinaryExpression: function( node, tabOffset ) {

			// If this is a comparison try for a rich comparison (which will fall back to an ordinary comparison otherwise)
			if ( spindle.api.__compare.OPERATORS[ node.operator ] ) {

				return API_ROOT + '.__compare(' + walk( node.left, tabOffset ) + ', ' + walk( node.right, tabOffset ) + ', "' + node.operator + '")';

			} else {

				return '(' + walk( node.left, tabOffset ) + ' ' + node.operator + ' ' + walk( node.right, tabOffset ) + ')';

			}

		},

		ConditionalExpression: function( node, tabOffset ) {

			var conditionString = walk( node.test, tabOffset );
			var thenString = walk( node.consequent, tabOffset );
			var elseString = walk( node.alternate, tabOffset );

			return '( ' + conditionString + ' ? ' + thenString + ' : ' + elseString + ' )';

		},

		NewExpression: notImplemented,

		MemberExpression: function( node, tabOffset ) {

			var text = walk( node.object, tabOffset );

			if ( node.computed ) {

				var output = walk( node.property, tabOffset );
				return text + '[ ' + output + ' ]';

			} else {

				return text + '.' + node.property.name;

			}

		},

		Identifier: function( node ) {

			if ( variableTable[ node.name ] ) {

				return node.name;

			} else {

				return API_ROOT + '.' + node.name;

			}

		},

		Literal: function( node ) {
			return node.raw;
		}

	};

	translationHandlers.Program = translationHandlers.BlockStatement;

};