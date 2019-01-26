function Migrator(db) {
  // Pending migrations to run
  var migrations = [];

  var state = 0;

  var MIGRATOR_TABLE = "_migrator_schema";

  // Use this method to actually add a migration.
  // You'll probably want to start with 1 for the migration number.
  this.migration = function(number, func) {
    migrations[number] = func;
  };

  // Execute a given migration by index
  var doMigration = function(number) {
    var promise = new Promise(function(resolve, reject) {
      if (migrations[number]) {
        db.transaction(function(t) {
          t.executeSql(
            "update " + MIGRATOR_TABLE + " set version = ?",
            [number],
            function(t) {
              debug(Migrator.DEBUG_HIGH, "Beginning migration %d", [number]);
              migrations[number](t);
              debug(Migrator.DEBUG_HIGH, "Completed migration %d", [number]);
              doMigration(number + 1).then(function() {
                resolve();
              });
            },
            function(t, err) {
              error("Error!: %o (while upgrading to %s from %s)", err, number);
              reject(err);
            }
          );
        });
      } else {
        debug(Migrator.DEBUG_HIGH, "Migrations complete.");
        state = 2;
        resolve();
      }
    });

    return promise;
  };

  // helper that actually calls doMigration from doIt.
  var migrateStartingWith = function(ver) {
    var promise = new Promise(function(resolve, reject) {
      state = 1;
      debug(Migrator.DEBUG_LOW, "Main Migrator starting.");

      try {
        return doMigration(ver + 1).then(function() {
          resolve();
        });
      } catch (e) {
        error(e);
        reject(e);
      }
    });

    return promise;
  };

  this.execute = function() {
    var promise = new Promise(function(resolve, reject) {
      if (state > 0) {
        throw "Migrator is only valid once -- create a new one if you want to do another migration.";
      }
      db.transaction(function(t) {
        t.executeSql(
          "select version from " + MIGRATOR_TABLE,
          [],
          function(t, res) {
            var rows = res.rows;
            var version = rows.item(0).version;
            debug(
              Migrator.DEBUG_HIGH,
              "Existing database present, migrating from %d",
              [version]
            );
            migrateStartingWith(version).then(function() {
              resolve();
            });
          },
          function(t, err) {
            if (err.message.match(/no such table/i)) {
              t.executeSql(
                "create table " + MIGRATOR_TABLE + "(version integer)",
                [],
                function() {
                  t.executeSql(
                    "insert into " + MIGRATOR_TABLE + " values(0)",
                    [],
                    function() {
                      debug(
                        Migrator.DEBUG_HIGH,
                        "New migration database created..."
                      );
                      migrateStartingWith(0).then(function() {
                        resolve();
                      });
                    },
                    function(t, err) {
                      error(
                        "Unrecoverable error inserting initial version into db: %o",
                        err
                      );
                      reject(err);
                    }
                  );
                },
                function(t, err) {
                  error("Unrecoverable error creating version table: %o", err);
                  reject(err);
                }
              );
            } else {
              error("Unrecoverable error resolving schema version: %o", err);
              reject(err);
            }
          }
        );
      });
    });

    return promise;
  };

  // Debugging stuff.
  var log =
    window.console && console.log
      ? function() {
          console.log.apply(console, argumentsToArray(arguments));
        }
      : function() {};
  var error =
    window.console && console.error
      ? function() {
          console.error.apply(console, argumentsToArray(arguments));
        }
      : function() {};

  var debugLevel = Migrator.DEBUG_NONE;

  var argumentsToArray = function(args) {
    return Array.prototype.slice.call(args);
  };
  this.setDebugLevel = function(level) {
    debugLevel = level;
  };

  var debug = function(minLevel, message, args) {
    if (debugLevel >= minLevel) {
      var newArgs = [message];
      if (args != null) for (var i in args) newArgs.push(args[i]);

      log.apply(null, newArgs);
    }
  };
}

// no output, low threshold (lots of output), or high threshold (just log the weird stuff)
// these might be a little, uh, backwards
Migrator.DEBUG_NONE = 0;
Migrator.DEBUG_LOW = 1;
Migrator.DEBUG_HIGH = 2;
