'use strict';

var _ = require( 'lodash' );
var acorn = require( 'acorn' );

module.exports = function( spindle ) {

	_.extend( spindle, {

		parse: function( text, suppressWarnings ) {

			if ( !text ) return;

			var comments = [];

			try {
				var parsed = acorn.parse( text, {

					onComment: function( block, content, start, end ) {

						comments.push( {
							block: block,
							content: content,
							start: start,
							end: end
						} );

					}

				} );

				parsed.comments = comments;

				return parsed;

			} catch ( e ) {

				if ( !suppressWarnings ) {

					spindle.console.warn( "Couldn't parse text: " + text, e );

				}
				return;
			}

		}

	} );

};