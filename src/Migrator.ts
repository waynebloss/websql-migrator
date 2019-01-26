import "websql";

export type Migration = (transaction: SQLTransaction) => void;

export class Migrator {
  static DEBUG_NONE = 0;
  static DEBUG_LOW = 1;
  static DEBUG_HIGH = 2;

  execute: () => Promise<void>;
  migration: (vnum: number, func: Migration) => void;
  setDebugLevel: (level: number) => void;

  constructor(db: Database) {
    // Pending migrations to run
    var migrations: Migration[] = [];

    var state = 0;

    var MIGRATOR_TABLE = "_migrator_schema";

    // Use this method to actually add a migration.
    // You'll probably want to start with 1 for the migration number.
    this.migration = function(vnum: number, func: Migration) {
      migrations[vnum] = func;
    };

    // Execute a given migration by index
    var doMigration = function(vnum: number) {
      var promise = new Promise(function(resolve, reject) {
        if (migrations[vnum]) {
          db.transaction(function(t) {
            t.executeSql(
              "update " + MIGRATOR_TABLE + " set version = ?",
              [vnum],
              function(t) {
                debug(Migrator.DEBUG_HIGH, "Beginning migration %d", [vnum]);
                migrations[vnum](t);
                debug(Migrator.DEBUG_HIGH, "Completed migration %d", [vnum]);
                doMigration(vnum + 1).then(function() {
                  resolve();
                });
              },
              function(_t, err) {
                error("Error!: %o (while upgrading to %s from %s)", err, vnum);
                reject(err);
                return false;
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
    var migrateStartingWith = function(ver: number) {
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
      var promise = new Promise<void>(function(resolve, reject) {
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
                        return false;
                      }
                    );
                  },
                  function(t, err) {
                    error(
                      "Unrecoverable error creating version table: %o",
                      err
                    );
                    reject(err);
                    return false;
                  }
                );
              } else {
                error("Unrecoverable error resolving schema version: %o", err);
                reject(err);
              }
              return false;
            }
          );
        });
      });

      return promise;
    };

    // Debugging stuff.
    var log =
      window.console && console.log
        ? function(...args: [any?, ...any[]]) {
            console.log.apply(console, args);
          }
        : function() {};
    var error =
      window.console && console.error
        ? function(...args: [any?, ...any[]]) {
            console.error.apply(console, args);
          }
        : function() {};

    var debugLevel: number = 0; // Migrator.DEBUG_NONE;

    this.setDebugLevel = function(level: number) {
      debugLevel = level;
    };

    var debug = function(minLevel: number, message: string, args?: any[]) {
      if (debugLevel >= minLevel) {
        var newArgs: [any?, ...any[]] = [message];
        if (args) {
          for (var i in args) {
            newArgs.push(args[i]);
          }
        }
        log.apply(null, newArgs);
      }
    };
  }
}
