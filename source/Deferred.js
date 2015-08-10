'use strict';

CK.threads.Deferred = function( name, handler ) {

	this.name = name;
	this.entries = [];
	this.handler = handler || function( input ) {
		this.fulfil( input );
	};
	this.pending = true;

};
CK.threads.Deferred.prototype = {

	promise: function() {

		var entry = {
			arguments: arguments
		};

		entry.promise = CK.threads.promise( this.name, function( fulfil, fail ) {

			entry.fulfil = fulfil;
			entry.fail = fail;

		} );

		this.entries.push( entry );

		if ( !this.pending ) {

			this.next();

		}

		return entry.promise;

	},

	wait: function() {

		var promise = this.promise.apply( this, arguments );
		promise.waiting = true;
		return promise;

	},

	resolve: function() {

		this.pending = false;
		while ( this.next() );

	},

	next: function() {

		var entry = this.entries.shift();

		if ( !entry ) return false;

		var promise = this.handler.apply( entry, entry.arguments );

		if ( promise ) {

			promise.then( entry.fulfil, entry.fail );

		}

		return true;

	}

};