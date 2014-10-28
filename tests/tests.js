function createCollection(callback) {
    var Model = Backbone.DualModel.extend({
        idAttribute: 'local_id',
        remoteIdAttribute: 'id'
    });

    var Collection = Backbone.DualCollection.extend({
        model: Model,
        initialize: function () {
            this.indexedDB = new Backbone.IndexedDB({
                storeName: 'test',
                dbVersion: 1,
                keyPath: 'local_id',  // same as idAttribute
                autoIncrement: true,
                indexes: [
                    {name: 'local_id', keyPath: 'local_id', unique: true},  // same as idAttribute
                    {name: 'id', keyPath: 'id', unique: true},  // same as remoteIdAttribute
                    {name: 'status', keyPath: 'status', unique: false}  // required
                ]
            }, this);
        },

        url: '/api/collection' // required
    });

    var collection = new Collection();

    collection.on('idb:ready', function () {
        callback(collection)
    });
}

QUnit.asyncTest("hello test", function (assert) {
    expect(1);

    createCollection(function (collection) {
        $.mockjax({
            url: "/api/collection",
            proxy: 'mocks/all.json'
        });
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            assert.ok(collection.length === 4, "Passed and ready to resume!");
            QUnit.start();
            collection.indexedDB.store.deleteDatabase();
            $.mockjax.clear()
        });
    });

});