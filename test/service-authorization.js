var should = require('chai').should();

var UplinkBuilder = require('../index');
var AuthorizationError = require('../lib/errors/authorization-error');

describe('Service', function() {
	var builder;

	beforeEach(function() {
		builder = new UplinkBuilder({
			auth: {
				authenticate: true,
				userToRoles: function(user) {
					return ['admin', 'user'];
				}
			}
		});
		builder.registerConstant('user', {
			isInRole: function(role) {
				return role === 'admin';
			}
		})
	});

	it('should pass authorization if auth() returns true', function*() {
			builder.registerServiceGroup(function() {
				this.def('test_svc', {
					properties: {
						id: { type: 'string' }
					},
					authorize: function() {
						return true;
					},
					execute: function(data) {
						return true;
					}
				});
			});

			yield builder.initialize();
			var uplink = builder.getUplink();
			var val = yield uplink.test_svc();
			val.should.equal(true);
	});

	it('should fail authorization if authorize() returns nothing', function*() {
			builder.registerServiceGroup(function() {
				this.def('test_svc', {
					properties: {
						id: { type: 'string' }
					},
					authorize: function() {
					},
					execute: function(data) {
						return true;
					}
				});
			});

			yield builder.initialize();
			var uplink = builder.getUplink();
			var success = false;
			try {
				var val = yield uplink.test_svc();
			} catch (e) {
				if (e instanceof AuthorizationError)
					success = true;
			}

			success.should.equal(true);
	});

	it('should pass authorization if authorize() is not defined', function*() {
			builder.registerServiceGroup(function() {
				this.def('test_svc', {
					properties: {
						id: { type: 'string' }
					},
					execute: function(data) {
						return true;
					}
				});
			});

			yield builder.initialize();
			var uplink = builder.getUplink();
			var val = yield uplink.test_svc();
			val.should.equal(true);
	});

	it('should fail authorization if authorize() returns false', function* () {
		builder.registerServiceGroup(function() {
			this.def('test_svc', {
				properties: {
					id: { type: 'string' }
				},
				authorize: function() {
					return false;
				},
				execute: function(data) {
					return true;
				}
			});
		});

		yield builder.initialize();
		var uplink = builder.getUplink();
		var success = false;
		try {
			var val = yield uplink.test_svc();
		} catch (e) {
			if (e instanceof AuthorizationError)
				success = true;
		}

		success.should.equal(true);
	});

	it('should fail authorization if authorize() returns a string', function* () {
		var errorMsg = 'Not authorized';
		builder.registerServiceGroup(function() {
			this.def('test_svc', {
				properties: {
					id: { type: 'string' }
				},
				authorize: function(data) {
					return errorMsg;
				},
				execute: function(data) {
					return true;
				}
			});
		});

		yield builder.initialize();
		var uplink = builder.getUplink();
		var success = false;
		try {
			var val = yield uplink.test_svc();
		} catch (e) {
			if (e instanceof AuthorizationError && e.message === errorMsg)
				success = true;
		}

		success.should.equal(true);
	});

	it('should pass authorization if authorize() is in role array', function* () {
		builder.registerServiceGroup(function() {
			this.def('test_svc', {
				properties: {
					id: { type: 'string' }
				},
				authorize: ['admin'],
				execute: function(data) {
					return true;
				}
			});
		});

		yield builder.initialize();
		var uplink = builder.getUplink();
		var val = yield uplink.test_svc();
		val.should.equal(true);
	});

	it('should pass authorization if authorize() is in a role string', function* () {
		builder.registerServiceGroup(function() {
			this.def('test_svc', {
				properties: {
					id: { type: 'string' }
				},
				authorize: 'admin',
				execute: function(data) {
					return true;
				}
			});
		});

		yield builder.initialize();
		var uplink = builder.getUplink();
		var val = yield uplink.test_svc();
		val.should.equal(true);
	});

	it('should fail authorization if authorize() is not in a role array', function* () {
		builder.registerServiceGroup(function() {
			this.def('test_svc', {
				properties: {
					id: { type: 'string' }
				},
				authorize: ['superadmin'],
				execute: function(data) {
					return true;
				}
			});
		});

		yield builder.initialize();
		var uplink = builder.getUplink();
		var success = false;
		try {
			var val = yield uplink.test_svc();
		} catch (e) {
			if (e instanceof AuthorizationError)
				success = true;
		}

		success.should.equal(true);
	});
});