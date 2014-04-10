var _ = require('lodash');

var ValidationError = function(errors) {
	if (_.isString(errors)) {
		this.message = errors;
	} else if (_.isObject(errors)) {
		this.errors = errors;
		this.message = "Validation failed.";
	} else {
		this.message = "Validation failed."
	}
};

ValidationError.prototype = new Error();
ValidationError.prototype.constructor = ValidationError;

ValidationError.prototype.toString = function() {
	if (this.errors === undefined) {
		return "Validation Error: " + this.message;
	} else {
		var msg = "Validation Errors: "
		var first = true;
		for (var key in this.errors) {
			if (first) {
				first = false;
			} else {
				msg += ', ';
			}
			msg += key + ': \'' + this.errors[key] + '\'';
		}
		return msg;
	}
};

module.exports = ValidationError;