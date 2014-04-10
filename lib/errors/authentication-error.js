var _ = require('lodash');

var AuthenticationError = function(message) {
	this.message = message;
};

AuthenticationError.prototype = new Error();
AuthenticationError.prototype.constructor = AuthenticationError;

AuthenticationError.prototype.toString = function() {
	if (this.message) {
		return 'Authentication failed: ' + this.message;
	} else {
		return 'Authentication failed.';
	}
};

module.exports = AuthenticationError;