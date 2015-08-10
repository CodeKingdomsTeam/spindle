'use strict';

( function() {

	var notImplemented = function( node ) {
		CK.Logger.warn( "Variable crawler not yet implemented for node", node );
		return '';
	};

	var walk = function( node, list ) {

		if ( node && variableHandlers[ node.type ] ) {

			variableHandlers[ node.type ]( node, list );

		}
	};

	CK.threads.variablesForFunctionNode = function( node ) {

		var list = [];

		_.each( node.params, function( param ) {

			list.push( param.name );

		} );

		walk( node.body, list );

		return list;
	};

	var variableHandlers = {

		BlockStatement: function( node, list ) {
			for ( var i in node.body ) {
				walk( node.body[ i ], list );
			}
		},
		ExpressionStatement: function( node, list ) {
			walk( node.expression, list );
		},
		IfStatement: function( node, list ) {

			walk( node.test, list );
			walk( node.alternate, list );
			walk( node.consequent, list );

		},
		SwitchStatement: notImplemented,
		ReturnStatement: function( node, list ) {
			walk( node.argument, list );
		},
		ThrowStatement: notImplemented,
		TryStatement: notImplemented,
		WhileStatement: function( node, list ) {

			walk( node.test, list );
			walk( node.body, list );

		},
		ForStatement: function( node, list ) {

			walk( node.init, list );
			walk( node.test, list );
			walk( node.update, list );
			walk( node.body, list );

		},
		ForInStatement: function( node, list ) {

			walk( node.left, list );
			walk( node.right, list );
			walk( node.body, list );

		},

		ForInit: notImplemented,

		VariableDeclaration: function( node, list ) {

			if ( node.kind !== 'var' ) {

				throw "Declaration type " + node.kind + " not supported";

			} else {

				for ( var i in node.declarations ) {

					var decl = node.declarations[ i ];
					list.push( decl.id.name );

					walk( decl.init, list );

				}

			}

		},
		FunctionDeclaration: function() {

			// Do nothing

		},
		Expression: function( node, list ) {
			return walk( node.expression, list );
		},
		FunctionExpression: function() {

			// Do nothing
		}
	};
	variableHandlers.Program = variableHandlers.BlockStatement;

} )();