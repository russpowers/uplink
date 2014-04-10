var _ = require('lodash');

var AuthorizationError = function(message) {
	this.message = message;
};

AuthorizationError.prototype = new Error();
AuthorizationError.prototype.constructor = AuthorizationError;

AuthorizationError.prototype.toString = function() {
	if (this.message) {
		return 'Authorization failed: ' + this.message;
	} else {
		return 'Authorization failed.';
	}
};

module.exports = AuthorizationError;