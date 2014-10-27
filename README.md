backbone-dualStorage
====================

A dual (indexedDB and REST) sync adapter for Backbone.js


example:

```
    var Model = Backbone.DualModel.extend({
        idAttribute: 'local_id',
        remoteIdAttribute: 'id'
    });

    var Collection = Backbone.DualCollection.extend({
        model: Model,
        initialize: function () {
            this.indexedDB = new Backbone.IndexedDB({
                storeName: 'notes',
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
        console.log('idb:ready');
        collection.firstSync().once(collection.eventNames.LOCAL_SYNC_SUCCESS, function () {
            console.log('fetched from local', collection.toJSON());
            collection.create({name: 'asd'}).save().done(function () {
                console.log('create one item, saved locally');
                collection.fullSync().done(function () {
                    console.log('synchronized successfully');
                }).fail(function () {
                    console.warn('synchronizing was failed');
                })
            })
        });
    });

```