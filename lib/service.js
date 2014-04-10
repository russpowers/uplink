'use strict';

var Promise = require('bluebird');
var tv4 = require('tv4');
var _ = require('lodash');
var ValidationError = require('./errors/validation-error');
var AuthorizationError = require('./errors/authorization-error');
var AuthenticationError = require('./errors/authentication-error');

var injectAsPromise = function(func, container, additional, receiver) {
	var res;
	try {
		res = container.injectWith(func, additional, receiver);
	} catch (err) {
		return new Promise(function() {
			throw err;
		});
	}
	if (res instanceof Promise) {
		return res;
	}	else if (res !== null && res !== undefined && _.isFunction(res.next)) {
		return Promise.spawn(function() { return res; });
	}	else {
		return Promise.resolve(res);
	}
}

var Service = function(uplink, name) {
	this.uplink = uplink;
	this.name = name;
};

Service.prototype._parseSchemaOptions = function(options) {
	var schema;

	// If schema is defined, we treat it as the full schema and
	// ignore any shortcuts.
	if (options.schema !== undefined) {
		return _.cloneDeep(options.schema);
	}

	if (options.properties !== undefined) {
		schema = {
			type: 'object',
			properties: _.cloneDeep(options.properties)
		};

		if (_.isArray(options.required)) {
			schema.required = _.clone(options.required);
		} else if (options.required === 'all') {
			schema.required = _.keys(options.properties);
		} else if (_.isString(options.required)) {
			schema.required = [ options.required ];
		}
	}

	this.schema = schema;
};

Service.prototype._parseVerbAndPathOptions = function(options) {
	var verb;
	var path;

	_.map(['get', 'put', 'post', 'del', 'delete'], function(v) {
		if (options[v] !== undefined) {
			if (verb !== undefined) {
				throw '[Uplink] def expects only one of get/post/put/delete to be defined';
			}

			verb = v;
			path = options[v];

			if (!_.isString(path)) {
				throw '[Uplink] def expects properties get/post/put/delete to be strings';
			}
		}
	});

	if (verb !== undefined && path !== undefined) {
		this.verb = verb;
		this.path = path;
	} else if (verb !== undefined) {
		this.verb = verb;
	} else {
		this.verb = 'post';
	}
};

Service.prototype._parseAuthOptions = function(options, authOptions) {
	var self = this;

	if (!authOptions) {
		this.authorize = function() { Promise.resolve(); }
		this.authenticate = false;
		return;
	}

	if (options.authenticate === false) {
		if (options.authorize) {
			throw new Error("Cannot have authorize without authenticate.");
		} else {
			this.authenticate = false;
		}
	} else if (options.authenticate === true) {
		this.authenticate = true;
	} else if (authOptions.authenticate) {
		this.authenticate = true;
	} else if (options.authorize) {
		this.authenticate = true;
	} else {
		this.authenticate = false;
	}

	if (options.authorize === true || this.authenticate)
		this.authMiddleware = authOptions.middleware;
	else if (options.authorize === false)
		this.authMiddleware = undefined;
	else if (options.authorize === undefined)
		this.authMiddleware = authOptions.authenticate ? authOptions.middleware : undefined;

	var authorize = options.authorize;

	if (_.isArray(authorize)) {
		if (authOptions.userToRoles === undefined) {
			throw "auth.userToRoles must be set to use array form auth."
		}

		this.authorize = function(obj, container) {
			return new Promise(function(resolve, reject) {
				var user = container.resolve('user');
				var userRoles = authOptions.userToRoles(user);
				for (var i = 0; i < authorize.length; ++i) {
					if (userRoles.indexOf(authorize[i]) !== -1) {
						return resolve();
					}
				}
				self._log.info('[Uplink]', 'Authorization failed because user not in specified roles');
				throw new AuthorizationError();
			});
		}
	} else if (_.isFunction(authorize)) {
		this.authorize = function(obj, container) {
			return injectAsPromise(authorize, container, { data: obj }, self)
				.then(function(res) {
				if (res === true) {
					return Promise.resolve();
				} else if (res === false) {
					self._log.info('[Uplink]', 'Authorization failed because false returned from authorize()');
					throw new AuthorizationError();
				} else if (_.isString(res)) {
					self._log.info('[Uplink]', 'Authorization failed because authorize() returned:\n', res);
					throw new AuthorizationError(res);
				} else {
					self._log.info('[Uplink]', 'Authorization failed because authorize() returned non-true value');
					throw new AuthorizationError();
				}
			})
		};
	} else {
		this.authorize = function() { return Promise.resolve(); }
	} 
};

Service.prototype.parseOptions = function(options, authOptions, logOptions) {
	this._parseSchemaOptions(options);
	this._parseVerbAndPathOptions(options);
	this._parseAuthOptions(options, authOptions);
	this._executeFn = options.execute;
	this._validateFn = options.validate;
	this._log = logOptions;
};

var filterInt = function (value) {
  if(/^(\-|\+)?([0-9]+|Infinity)$/.test(value))
    return Number(value);
  return NaN;
}

// Converts strings to ints if they fit
Service.prototype.parseInts = function(obj) {
	if (this.schema === undefined) {
		return;
	}

	var props = this.schema.properties;
	for (var key in this.schema.properties) {
		if (typeof obj[key] === 'string' &&
			(props[key] === 'integer' || props[key].type === 'integer')) {
			var val = filterInt(obj[key]);
			if (val !== NaN) {
				obj[key] = val;
			}
		}
	}
}

Service.prototype._removeUnknownProperties = function(obj) {
	if (this.schema !== undefined) {
		for (var key in obj) {
			if (this.schema.properties[key] === undefined) {
				this._log.info('[Uplink]', 'Removing unknown property:', key);
				delete obj[key];
			}
		}
	}
}

Service.prototype._removeNullProperties = function(obj) {
	for (var key in obj) {
		if (obj[key] === null) {
			this._log.info('[Uplink]', 'Removing null property:', key);
			delete obj[key];
		}
	}
};

Service.prototype._removeUndefinedProperties = function(obj) {
	for (var key in obj) {
		if (obj[key] === undefined) {
			this._log.info('[Uplink]', 'Removing undefined property:', key);
			delete obj[key];
		}
	}
};

Service.prototype.execute = function(obj, container) {
	var self = this;

	if (obj === undefined) {
		obj = Object.create(null);
	}

	this._log.info('[Uplink]', 'Executing service:', this.name);
	this._log.debug('[Uplink]', 'Incoming data:\n', obj);

	// If we don't have a user and authentication is required, bail
	if (this.authenticate && !container.resolve('user')) {
		return new Promise(function(resolve, reject) {
			throw new AuthenticationError();
		});
	}

	return this.validate(obj, container)
		.then(function() {
			return self.authorize(obj, container);
		})
		.then(function() {
			return injectAsPromise(self._executeFn, container, { data: obj }, self);
		}).then(function(res) {
			self._log.debug('[Uplink]', 'Outgoing data:\n', res);
			return res;
		}).catch(function(err) {
			if (!(err instanceof ValidationError) && !(err instanceof AuthorizationError)) {
				self._log.error('[Uplink]', 'Error:\n', err);
			}
			throw err;
		});
};

Service.prototype.validate = function(obj, container) {
	if (this.schema !== undefined) {
		this._removeUnknownProperties(obj);
		this._removeNullProperties(obj);
		this._removeUndefinedProperties(obj);
		var res = tv4.validateMultiple(obj, this.schema);
		if (!res.valid) {
			var self = this;
			return Promise.resolve().then(function() {
				var errs = _.reduce(res.errors, function (errors, err) {
					errors[err.dataPath.substring(1)] = err.message;
					return errors;
				}, {});
				self._log.info('[Uplink]', 'Validation failed based on schema:\n', errs);
				throw new ValidationError(errs);
			});
		}
	}

	if (this._validateFn === undefined) {
		return Promise.resolve();
	}	else {
		var self = this;
		return injectAsPromise(this._validateFn, container, { data: obj}, this)
			.then(function(res) {
				if (res === true) {
					return Promise.resolve();
				} else if (res === false) {
					self._log.info('[Uplink]', 'Validation failed based on false returned from validate()');
					throw new ValidationError();
				} else if (_.isString(res)) {
					self._log.info('[Uplink]', 'Validation failed based on validate():\n', res);
					throw new ValidationError(res);
				}	else if (_.isObject(res)) {
					self._log.info('[Uplink]', 'Validation failed based on validate():\n', res);
					throw new ValidationError(res);
				} else {
					return Promise.resolve();
				}
			})
	}
};

module.exports = Service;