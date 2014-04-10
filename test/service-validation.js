var should = require('chai').should();

var UplinkBuilder = require('../index');
var ValidationError = require('../lib/errors/validation-error');

describe('Service', function() {
	var builder;

	beforeEach(function() {
		builder = new UplinkBuilder();
	});

	it('should pass validation if validate() returns true', function*() {
			builder.registerServiceGroup(function() {
				this.def('test_svc', {
					properties: {
						id: { type: 'string' }
					},
					validate: function(data) {
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

	it('should pass validation if validate() returns nothing', function*() {
			builder.registerServiceGroup(function() {
				this.def('test_svc', {
					properties: {
						id: { type: 'string' }
					},
					validate: function(data) {
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

	it('should pass validation if validate() is not defined', function*() {
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

	it('should fail validation if validate() returns false', function* () {
		builder.registerServiceGroup(function() {
			this.def('test_svc', {
				properties: {
					id: { type: 'string' }
				},
				validate: function(data) {
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
			if (e instanceof ValidationError)
				success = true;
		}

		success.should.equal(true);
	});

	it('should fail validation if validate() returns an error object', function* () {
		var errors = {};
		builder.registerServiceGroup(function() {
			this.def('test_svc', {
				properties: {
					id: { type: 'string' }
				},
				validate: function(data) {
					return errors;
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
			if (e instanceof ValidationError && e.errors === errors)
				success = true;
		}

		success.should.equal(true);
	});
});