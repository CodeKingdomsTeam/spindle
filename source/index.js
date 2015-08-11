'use strict';

var _ = require( 'lodash' );
var requireDir = require( 'require-dir' );

var defineLibrary = function( globalOptions ) {


	var spindle = _.defaults( globalOptions || {}, {

		stack: [],
		waiting: [],
		api: {},
		console: console,
		apiRoot: 'spindle.api'

	} );

	var importLibrary = function( library ) {

		library( spindle );

	};

	var importDirectories = [ 'api', 'classes', 'runtime', 'translation', 'utils' ];

	_.each( importDirectories, function( value ) {

		_.each( requireDir( './' + value ), importLibrary );

	} );

	return spindle;

};

module.exports = defineLibrary;