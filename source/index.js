'use strict';

var _ = require( 'lodash' );

var defineLibrary = function( globalOptions ) {

	var spindle = _.defaults( globalOptions || {}, {

		stack: [],
		waiting: {},
		api: {},
		babelOptions: {
			loose: "all"
		},
		console: console,
		apiRoot: 'spindle.api'

	} );

	require( './api/compare.js' )( spindle );
	require( './api/wait.js' )( spindle );
	require( './classes/Executor.js' )( spindle );
	require( './classes/Thread.js' )( spindle );
	require( './runtime/run.js' )( spindle );
	require( './runtime/thread.js' )( spindle );
	require( './translation/translator.js' )( spindle );
	require( './translation/variableWalker.js' )( spindle );
	require( './utils/basic.js' )( spindle );
	require( './utils/method.js' )( spindle );
	require( './utils/parse.js' )( spindle );

	return spindle;

};

module.exports = defineLibrary;