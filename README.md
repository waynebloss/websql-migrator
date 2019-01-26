# Web SQL Migrator

An HTML5 web database migrator utility.

## Installation

```sh
npm install websql-migrator
# or
yarn add websql-migrator
```

## Usage

```js
var db = openDatabase("example_db", "", "Example Database", 100000);
var M = new Migrator(db);

//set your migrations in the order that they need to occur
M.migration(1, function(t) {
  //put one or more WebSQL transactions here to accomplish the migration
  t.executeSql("create table example(id integer primary key, name text)");
  t.executeSql(
    "create table example2(id integer primary key, somethingElse text"
  );
});
M.migration(2, function(t) {
  t.executeSql("alter table example add column somethingElse text");
});
M.migration(3, function(t) {
  t.executeSql(
    "alter table example2 add column somethingEntirelyDifferent text"
  );
});

//Execute will do all the migrations required for the particular user (e.g., if
// they're at v1 take them to v2 and then v3)
M.execute().then(function() {
  //now go about executing your SQL or whatever to load the page or site
});
```

See
[demo/address-book.html](./demo/address-book.html)
for a full working example.

## Roadmap

- Put the nice errors that are outputted to the console in the reject() calls.
- Better error handling in general- probably should be doing more with catching
  errors in the promise chain.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## MIT License

See [LICENSE.md](./LICENSE.md).
