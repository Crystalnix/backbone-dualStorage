function createCollection(callback) {
    var Model = Backbone.DualModel.extend({
        idAttribute: 'local_id',
        remoteIdAttribute: 'id'
    });

    var Collection = Backbone.DualCollection.extend({
        model: Model,
        initialize: function () {
            this.indexedDB = new Backbone.IndexedDB({
                storeName: 'test_' + $.now() + Math.random(),
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

//QUnit.asyncTest("Load remote data via first sync and existing local data", function (assert) {
//    expect(3);
//
//    createCollection(function (collection) {
//        $.mockjax({
//            url: "/api/collection",
//            proxy: 'mocks/all.json'
//        });
//        window.collection = collection;
//        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
//            collection.indexedDB.store.deleteDatabase();
//            assert.ok(collection.length === 4, "items were fetched");
//            assert.ok(collection.get(1).get('name') === "John", "name is John");
//            assert.ok(collection.get(1).get('IQ') === null, "IQ is null");
//            QUnit.start();
//            $.mockjax.clear()
//        });
//    });
//
//});

QUnit.asyncTest("Get delayed data", function (assert) {
    expect(1);

    createCollection(function (collection) {
        $.mockjax({
            url: "/api/collection",
            proxy: 'mocks/all.json'
        });
        window.collection = collection;
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var dude = collection.get(1).toJSON();
            delete dude.id;
            delete dude.local_id;
            var model = collection.create(dude);
            model.once('sync', function () {

                var model2 = collection.get(2);
                var name = "Ivan";
                model2.save('name', name).done(function () {
                    model2.fetch().done(function () {

                        var model3 = collection.get(3);
                        model3.destroy().done(function () {
                            collection.fetch().done(function () {
                                collection.getDelayedData().done(function (data) {
                                    console.log(data);
                                    assert.ok(data.length === 3, "It should be correct length");
                                    QUnit.start();
                                    collection.indexedDB.store.deleteDatabase();
                                });
                            })
                        });

                    })
                });

            });
        });
    });

});

QUnit.asyncTest("Load remote data via first sync", function (assert) {
    expect(3);

    createCollection(function (collection) {
        $.mockjax({
            url: "/api/collection",
            proxy: 'mocks/all.json'
        });
        window.collection = collection;
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            collection.indexedDB.store.deleteDatabase();
            assert.ok(collection.length === 4, "items were fetched");
            assert.ok(collection.get(1).get('name') === "John", "name is John");
            assert.ok(collection.get(1).get('IQ') === null, "IQ is null");
            QUnit.start();
            $.mockjax.clear()
        });
    });

});

QUnit.asyncTest("Creating the model", function (assert) {
    expect(4);

    createCollection(function (collection) {
        $.mockjax({
            url: "/api/collection",
            proxy: 'mocks/all.json'
        });
        window.collection = collection;
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var dude = collection.get(1).toJSON();
            delete dude.id;
            delete dude.local_id;
            var model = collection.create(dude);
            model.once('sync', function () {
                assert.ok(model.get('local_id') === 5, "Local id should be defined");
                assert.ok(model.get('local_id') === model.id, "Local id should be same as model id");
                assert.ok(model.get('id') === void 0, "Remote id should be undefined");
                assert.ok(model.get('status') === collection.states.CREATE_FAILED, "Status should be 'create failed'");
                QUnit.start();
                collection.indexedDB.store.deleteDatabase();
            });

            $.mockjax.clear()
        });
    });

});

QUnit.asyncTest("Updating the new model", function (assert) {
    expect(5);

    createCollection(function (collection) {
        $.mockjax({
            url: "/api/collection",
            proxy: 'mocks/all.json'
        });
        window.collection = collection;
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var dude = collection.get(1).toJSON();
            delete dude.id;
            delete dude.local_id;
            var model = collection.create(dude);
            model.once('sync', function () {
                var name = "Ivan";
                model.save('name', name).done(function () {
                    model.fetch().done(function () {
                        assert.ok(model.get('local_id') === 5, "Local id should be defined");
                        assert.ok(model.get('local_id') === model.id, "Local id should be same as model id");
                        assert.ok(model.get('id') === void 0, "Remote id should be undefined");
                        assert.ok(model.get('name') === name, "Name should be changed");
                        assert.ok(model.get('status') === collection.states.CREATE_FAILED, "Status should be 'create failed'");
                        QUnit.start();
                        collection.indexedDB.store.deleteDatabase();
                    })
                });

            });

            $.mockjax.clear()
        });
    });

});

QUnit.asyncTest("Updating the existing model", function (assert) {
    expect(5);

    createCollection(function (collection) {
        $.mockjax({
            url: "/api/collection",
            proxy: 'mocks/all.json'
        });
        window.collection = collection;
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var model = collection.get(1);
            var name = "Ivan";
            model.save('name', name).done(function () {
                model.fetch().done(function () {
                    assert.ok(model.get('local_id') !== void 0, "Local id should be defined");
                    assert.ok(model.get('local_id') === model.id, "Local id should be same as model id");
                    assert.ok(model.get('id') !== void 0, "Remote id should be defined");
                    assert.ok(model.get('name') === name, "Name should be changed");
                    assert.ok(model.get('status') === collection.states.UPDATE_FAILED, "Status should be 'create failed'");
                    QUnit.start();
                    collection.indexedDB.store.deleteDatabase();
                })
            });


            $.mockjax.clear()
        });
    });

});

QUnit.asyncTest("Deleting the model", function (assert) {
    expect(2);

    createCollection(function (collection) {
        $.mockjax({
            url: "/api/collection",
            proxy: 'mocks/all.json'
        });
        window.collection = collection;
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var model = collection.get(1);
            var len = collection.length;
            model.destroy().done(function () {
                collection.fetch().done(function () {
                    assert.ok(model.get('status') === collection.states.DELETE_FAILED, "Status should be 'create failed'");
                    assert.ok(collection.length + 1 === len, "items in the collection should be less");
                    QUnit.start();
                    collection.indexedDB.store.deleteDatabase();

                })
            });




            $.mockjax.clear()
        });
    });

});