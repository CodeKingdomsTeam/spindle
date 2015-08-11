'use strict';

var _ = require( 'lodash' );

module.exports = function( spindle ) {

	_.extend( spindle, {

		/* global Promise: true */
		promise: function( name, run ) {

			var promise = new Promise( run );
			promise.name = name;
			return promise;

		},

		isGenerator: function( it ) {

			return it && it.next;

		}

	} );

};