var Uplink = require('uplink');
var Knex = require('knex');
var Promise = require('bluebird');

module.exports = function(uplinkBuilder, options) {

	var db = options.knex;

	uplinkBuilder.registerConstant('db', db);

	uplinkBuilder.registerResolver('db', {
		scope: 'request',
		create: function(txManager) {
			return function(table) {
				if (table) {
					if (txManager.tx) {
						return db(table).transacting(txManager.tx);
					} else {
						return db(table);
					}
				} else {
					if (txManager.tx) {
						return db.transacting(txManager.tx);
					} else {
						return db;
					}
				}
			};
		}
	});

	uplinkBuilder.registerResolver('txManager', {
		scope: 'request',
		create: function() {
			return { tx: null };
		}
	});

	uplinkBuilder.registerResolver('tx', {
		scope: 'request',
		create: function*(txManager) {
			var resolver = Promise.defer();
			var r = {
				txDone: false
			};

			r.txPromise = db.transaction(function(tx) {
				txManager.tx = tx;
				r.tx = tx;

				r.table = function(table) {
					return db(table).transacting(tx);
				};

				r.commit = function() {
					if (!r.txDone) {
						return tx.commit();
					} else {
						return true;
					}
				};

				r.rollback = function() {
					if (!r.txDone) {
						return tx.rollback();
					} else {
						return true;
					}
				};

				resolver.resolve(r);
			});
			return yield resolver.promise;
		},

		complete: function*() {
			if (!this.txDone) {
				this.tx.commit();
				yield this.txPromise;
			}	else {
				return true;
			}
		},

		error: function() {
			if (!this.txDone) {
				this.tx.rollback();
				var deferred = Promise.defer();
				// we expect an error for rollback
				this.txPromise.error(function() { deferred.resolve(); });
				return deferred;
			}	else {
				return true;
			}
		},

		finally: function(txManager) {
			txManager.tx = null;
			return true;
		}

	});

};