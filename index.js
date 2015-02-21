/*
 * Mongoose JSON Patch Plugin
 *
 * Don't patch like an idiot
 * http://williamdurand.fr/2014/02/14/please-do-not-patch-like-an-idiot/
 */

var _ = require('lodash'),
	mpath = require('mpath'),
	jsonpatch = require('fast-json-patch');

/*
 * Configuration
 * TODO: make configurable
 */
var globalReadBlacklist = [];
var globalWriteBlacklist = ['_id', '__v'];

/*
 * Plugin
 */
module.exports = exports = function checkPermissions(schema, options) {

	var self = this;

	/*
	===========
	PATCH LOGIC
	===========
	*/
	
	//Find all attributes that have writable set to false
	var schemaWriteBlacklist = _.filter(Object.keys(schema.paths), function(pathName) {
		var path = schema.path(pathName);
		if(path.options && path.options.writable != undefined) {
			return path.options.writable == false;
		}
		return false;
	});

	//Add them to the blacklist
	this.writeBlacklist = _.union(globalWriteBlacklist, schemaWriteBlacklist);

	schema.method('patch', function(patches, callback) {

		//Check to make sure none of the paths are on the write blacklist
		for(var i = 0; i < writeBlacklist.length; i++) {
			var pathName = mpathToJSONPointer(writeBlacklist[i]);

			for(var j = 0; j < patches.length; j++) {
				if(patches[j].path == pathName) {
					return callback(new Error('Modifying ' + pathName + ' is not allowed.'));
				}
			}
		}

		//Apply the patch
		try {
			jsonpatch.apply(this, patches, true);
		} catch(err) {
			return callback(err);
		}

		//Save the document (or parent document if this happens to be a subdocument)
		if(this.ownerDocument && this.ownerDocument()) return this.ownerDocument().save(callback);
		return this.save(callback);
	});

	/*
	 * Basic implementation converter Mongoose/MongoDB style paths to JSON Pointers (RFC6901)
	 * user.authLocal.email -> /user/authLocal/email
	 */
	function mpathToJSONPointer(path) {
		return '/' + path.split('.').join('/');
	}

	

	/*
	========================
	PROTECTED PROPERTY LOGIC
	========================
	*/

	//Find all attributes that have readable set to false
	var schemaReadBlacklist = _.filter(Object.keys(schema.paths), function(pathName) {
		var path = schema.path(pathName);
		if(path.options && path.options.readable != undefined) {
			return path.options.readable == false;
		}
		return false;
	});

	this.readBlacklist = _.union(globalReadBlacklist, schemaReadBlacklist);
	
	/*
	 * Takes this object and removes any properties that are marked as {readable: false} in the schema.
	 * Supplying any additional keys as arguments will remove them.
	 */
	schema.method('filterProtected', function() {

		var thisObj = this.toObject({virtuals: true, getters: true});

		var readBlacklist = _.union(self.readBlacklist, arguments);
		for(var i = 0; i < readBlacklist.length; i++) {
			var pathName = readBlacklist[i];
			mpath.set(pathName, undefined, thisObj);
		}

		return thisObj;
	});

	//Static method for calling filterProtected on an array of documents
	schema.statics.filterProtected = function(collection) {

		var args = [].slice.call(arguments); //Copy the arguments
		args.shift(); //Remove the first argument (collection)

		for(var i = 0; i < collection.length; i++) {
			collection[i] = collection[i].filterProtected.apply(collection[i], args);
		}
		return collection;
	}
	
};