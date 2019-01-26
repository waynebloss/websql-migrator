An HTML5 web database migrator utility.

Max explains the idea much better in his blog post here: http://blog.maxaller.name/2010/03/html5-web-sql-database-intro-to-versioning-and-migrations/

All I did was eliminate the callbacks and make it return a promise instead. This probably makes sense if you wrap all of your WebSQL code in promises. Maybe I'll post some helpers for that later :-).

Thoughts for the future:
- put the nice errors that are outputted to the console in the reject() calls
- better error handling in general- probably should be doing more with catching errors in the promise chain

= Usage =

	var db = openDatabase("example_db", "", "Example Database", 100000);
	var M = new Migrator(db);

	//set your migrations in the order that they need to occur
	M.migration(1, function(t){
		//put one or more WebSQL transactions here to accomplish the migration
		t.executeSql("create table example(id integer primary key, name text)");
		t.executeSql("create table example2(id integer primary key, somethingElse text");
	});
	M.migration(2, function(t){
		t.executeSql("alter table example add column somethingElse text");
	});
	M.migration(3, function(t){
		t.executeSql("alter table example2 add column somethingEntirelyDifferent text");
	});

	//Execute will do all the migrations required for the particular user (e.g., if they're at v1 take them to v2 and then v3)
	M.execute().then(function() {
		//now go about executing your SQL or whatever to load the page or site
	});


See test.html or homepage for a full working example.

= License =
MIT license, see LICENSE.