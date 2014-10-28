function createCollection(callback) {
    var Model = Backbone.DualModel.extend({
        idAttribute: 'local_id',
        remoteIdAttribute: 'id'
    });

    var Collection = Backbone.DualCollection.extend({
        model: Model,

        mergeFirstSync: function (newData) {
            var data = [];
            this.each(function (item) {
                var id = item.get('id');
                if (id) {
                    var a = _.findWhere(newData, {id: id});
                    var b = _.extend({}, item.toJSON(), a);
                    delete b.status;
                    data.push(b);
                    newData = _.filter(newData, function (x) { return x.id !== id});
                }
                else {
                    data.push(item.toJSON())
                }
            });
            return _.union(data, newData);
        },

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

QUnit.asyncTest("Load remote data via first sync and existing local data", function (assert) {
    expect(3);

    createCollection(function (collection) {
        $.mockjax({
            url: "/api/collection",
            proxy: 'mocks/all.json'
        });
        var name = "IVAN";
        var model1 = collection.create({name: name}, {wait: true});
        model1.once('sync', function () {
            var model2 = collection.create({id: 2, name: name}, {wait: true});
            model2.once('sync', function () {
                collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
                    collection.indexedDB.store.deleteDatabase();
                    assert.ok(collection.length === 5, "Items were fetched and merged");
                    assert.ok(collection.get(model1.id).get('name') === name, "Name is " + name);
                    assert.ok(collection.get(model2.id).get('name') !== name, "Name not is " + name);
                    QUnit.start();
                    $.mockjax.clear()
                });
            });
        });


    });

});

QUnit.asyncTest("Get delayed data", function (assert) {
    expect(1);

    createCollection(function (collection) {
        $.mockjax({
            url: "/api/collection",
            proxy: 'mocks/all.json'
        });
        
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var dude = collection.at(1).toJSON();
            delete dude.id;
            delete dude.local_id;
            var model = collection.create(dude);
            model.once('sync', function () {

                var model2 = collection.at(2);
                var name = "Ivan";
                model2.save('name', name).done(function () {
                    model2.fetch().done(function () {

                        var model3 = collection.at(3);
                        model3.destroy().done(function () {
                            collection.fetch().done(function () {
                                collection.getDelayedData().done(function (data) {
                                    assert.ok(data.length === 3, "Length should be correct ");
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
        
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            collection.indexedDB.store.deleteDatabase();
            assert.ok(collection.length === 4, "items were fetched");
            assert.ok(collection.at(0).get('name') === "John", "name is John");
            assert.ok(collection.at(0).get('IQ') === null, "IQ is null");
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
        
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var dude = collection.at(1).toJSON();
            delete dude.id;
            delete dude.local_id;
            var model = collection.create(dude);
            model.once('sync', function () {
                assert.ok(model.get('local_id') !== void 0, "Local id should be defined");
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
        
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var dude = collection.at(1).toJSON();
            delete dude.id;
            delete dude.local_id;
            var model = collection.create(dude);
            model.once('sync', function () {
                var name = "Ivan";
                model.save('name', name).done(function () {
                    model.fetch().done(function () {
                        assert.ok(model.get('local_id') !== void 0, "Local id should be defined");
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
        
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var model = collection.at(1);
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
        
        collection.firstSync().once(collection.eventNames.SYNCHRONIZED, function () {
            var model = collection.at(1);
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