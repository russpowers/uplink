'use strict';
var _ = require('lodash');
var Promise = require('bluebird');
var dirject = require('dirject');
var DI = require('gendi');
var Service = require('./service');
var tv4 = require('./tv4');
var stream = require('stream');
var ValidationError = require('./errors/validation-error');
var AuthorizationError = require ('./errors/authorization-error');
var AuthenticationError = require ('./errors/authentication-error');

var Uplink = function(app, container) {

	this.__INTERNAL__ = {
		app: app,
		services: Object.create(null),
		container: container
	};
	this.__CONTAINER__ = container;
};

Uplink.prototype.createProxy = function(container) {
	var other = Object.create(this);
	other.__CONTAINER__ = container;
	return other;
}

var SvcBuilder = function(app, container) {
	this.uplink = new Uplink(app, container);
	this.options = {};
};

SvcBuilder.prototype.def = function(name, options) {
	if (name.length === 0) {
		throw "[Uplink] Service name cannot be empty";
	}

	if (!_.isFunction(options.execute)) {
		throw '[Uplink] def expects an "execute" function';
	}

	if (_.has(this.uplink, name)) {
		throw '[Uplink] Service has already been defined: ' + name;
	}

	var service = new Service(this.uplink, name);
	service.parseOptions(options, this.options.auth, this.options.log);
	this.uplink.__INTERNAL__.services[name] = service;
	this.uplink[name] = function(obj) {
		return service.execute(obj, this.__CONTAINER__)
			.catch(function(err) {
				throw err;
			});
	};
};

var UplinkBuilder = function(options) {
	this.options = options || {};
	this.di = new DI();
	this.directories = this.options.directories || [];
	this.context = function() { };
	this.serviceGroups = [];
	this.loadLanguage(this.options.language || 'en');
	this.scopes = {
		global: this.di.define('global'),
		request: this.di.define('request', 'global'),
		service: this.di.define('service', 'request')
	};

	options = this.options;
	if (options.log) {
		if (options.log.level === 'debug') {
			options.log.debug = options.log.debug || console.log;
			options.log.info = options.log.info || console.log;
			options.log.warn = options.log.warn || console.log;
			options.log.error = options.log.error || console.log;
		} else if (options.log.level === 'info') {
			options.log.debug = function() {};
			options.log.info = options.log.info || console.log;
			options.log.warn = options.log.warn || console.log;
			options.log.error = options.log.error || console.log;
		} else if (options.log.level === 'warn') {
			options.log.debug = function() {};
			options.log.info = function() {};
			options.log.warn = options.log.warn || console.log;
			options.log.error = options.log.error || console.log;
		}
		else {
			options.log.debug = function() {};
			options.log.info = function() {};
			options.log.warn = function() {};
			options.log.error = options.log.error || console.log;
		}
	} else {
		options.log = {
			debug: function() {},
			info: function() {},
			warn: function() {},
			error: console.log
		};
	}

	this.rootContainer = this.di.createRoot('global');
};

UplinkBuilder.prototype.loadLanguage = function(language) {
	require('./locales/' + language + '/tv4-lang')(tv4);
	tv4.language(language);
	require('./locales/' + language + '/tv4-formats')(tv4);
	this.language = language;
}

UplinkBuilder.prototype.plugin = function(plugin, options) {
	if (typeof plugin === 'string') {
		require('../plugins/'+plugin)(this, options);
	} else {
		plugin(this, options);
	}
}

UplinkBuilder.prototype.initialize = function(app) {
	this.builder = new SvcBuilder(app, this.rootContainer);
	this.builder.options = this.options;
	this.uplink = this.builder.uplink;
	this.app = app;

	this.scopes.global
		.constant('Promise', Promise)
		.constant('ValidationError', ValidationError)
		.constant('AuthorizationError', AuthorizationError)
		.constant('AuthenticationError', AuthenticationError);

	if (app !== undefined) {
		this.scopes.global
			.constant('app', app);
	}

	var promises = [];

	this.serviceGroups.forEach(function(serviceGroup) {
		promises.push(this.rootContainer.inject(serviceGroup, this.builder));
	}, this);

	this.directories.forEach(function(path) {
		promises.push(dirject(this.rootContainer, this.builder, path));
	}, this);

	var options = this.builder.options;
	var self = this;

	return Promise.all(promises).then(function() {
		self._createHandlers();
		self._createDirectoryHandler();
	})
};

var paramsAsNumbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

var normalizePath = function(path) {
	var segments = path.split('/');
	var result = '';
	for (var i = 1; i < segments.length; ++i) {
		result += '/';
		if (segments[i].indexOf(':') === 0) {
			result += ':' + paramsAsNumbers[i];
		} else {
			result += segments[i];
		}
	}
	return result;
};

UplinkBuilder.prototype._createHandler = function(service, options) {

	var handler = function (req, res) {
		var obj = {};

		var container = service.uplink.__INTERNAL__.container.createChild('request');
		var uplinkProxy = service.uplink.createProxy(container);

		container
			.instance('request', req)
			.instance('response', res)
			.instance('uplink', uplinkProxy);
			
		if (options.auth && options.auth.reqToUser) {
			container.instance('user', options.auth.reqToUser(req));
		}

		// Eventually, these should be sanitized.  
		// Should have an allowed list on the service..
		_.assign(obj, req.query);
		_.assign(obj, req.params);

		
		_.assign(obj, req.body);

		// Convert URL string values to ints if validation expects an int
		service.parseInts(obj);
		
		service.execute(obj, container)
			.then(function(eres) {
				return container.action('complete')
					.then(function() { return container.action('finally'); })
					.then(function() {
						if (eres) {
							if (Buffer.isBuffer(eres)) {
								res.send(eres);
							} else if (eres instanceof stream.Readable) {
								eres.pipe(res);
							} else {
								res.json(eres);
							}
						} else {
							res.json(eres);
						}
					});
			})
			.error(function(eres) {
				return container.action('error')
					.then(function() { return container.action('finally'); })
					.then(function() {
						res.statusCode = 500;
						res.send(eres.toString());
					})
			})
			.catch(AuthorizationError, function(err) {
				return container.action('error')
					.then(function() { return container.action('finally'); })
					.then(function() {
						res.statusCode = 403;
						res.send(err.toString());
					});
			})
			.catch(AuthenticationError, function(err) {
				return container.action('error')
					.then(function() { return container.action('finally'); })
					.then(function() {
						res.statusCode = 401;
						res.send(err.toString());
					});
			})
			.catch(ValidationError, function(err) {
				return container.action('error')
					.then(function() { return container.action('finally'); })
					.then(function() {
						res.statusCode = 400;
						if (err.stack) {
							delete err.stack;
						}
						res.json(err);
					});
			})
			.catch(function(err) {
				return container.action('error')
					.then(function() { return container.action('finally'); })
					.then(function() {
						res.statusCode = 500;
						res.send(err.toString());
					})
			});
	}

	// Create a route based on the service name
	if (this.options.servicePath !== undefined) {
		if (service.authMiddleware) {
			this.app[service.verb](this.options.servicePath+'/'+service.name, service.authMiddleware, handler);
		}
		else {
			this.app[service.verb](this.options.servicePath+'/'+service.name, handler);
		}
	}

	if (service.path === undefined) { return; }

	// Create a route based on specified path
	if (service.authMiddleware) {
		this.app[service.verb](service.path, service.authMiddleware, handler);
	}
	else {
		this.app[service.verb](service.path, handler);
	}

	// Track specified path for options route entry
	var normalizedPath = normalizePath(service.path);
	if (!(normalizedPath in options)) {
		options[normalizedPath] = {};
	}

	options[normalizedPath][service.verb.toUpperCase()] = {
		name: service.name,
		schema: service.schema
	};
};

UplinkBuilder.prototype._createDirectoryHandler = function() {
	if (this.app === undefined) { return; }
	if (this.options.servicePath === undefined) { return; }
	var directory = {};
	var services = this.uplink.__INTERNAL__.services;
	_.forIn(services, function(service) {
		directory[service.name] = {
			verb: service.verb,
			schema: service.schema
		};
	});

	this.app.get(this.options.servicePath, function(req, res) {
		return res.json(directory);
	});
};

UplinkBuilder.prototype._createHandlers = function() {
	if (this.app === undefined) { return; }

	var services = this.uplink.__INTERNAL__.services;
	var options = this.options;

	_.forIn(services, function(service) {
		this._createHandler(service, options);
	}, this);

	_.forIn(options, function(value, key) {
		this.app.options(key, function(req, res) {
			return res.json(value);
		});
	}, this);
	
};

UplinkBuilder.prototype.registerServiceGroup = function(serviceGroup) {
	this.serviceGroups.push(serviceGroup);
};

UplinkBuilder.prototype.disableAuth = function() {
	delete this.options.auth;
	return this;
};

UplinkBuilder.prototype.registerConstant = function(name, obj) {
	this.scopes.global.constant(name, obj);
};

UplinkBuilder.prototype.registerResolver = function(name, obj) {
	var scope = obj.scope || 'global';
	delete obj.scope;
	this.scopes[scope].resolver(name, obj);
};

UplinkBuilder.prototype.getUplink = function() {
	return this.uplink;
}

module.exports = UplinkBuilder;
