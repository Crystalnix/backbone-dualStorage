backbone-dualStorage
====================

A dual (indexedDB and REST) sync adapter for Backbone.js


example:

```
    var Model = Backbone.DualModel.extend({
        idAttribute: 'local_id'
    });

    var Collection = Backbone.DualCollection.extend({
        model: Model,
        initialize: function () {
            this.indexedDB = new Backbone.IndexedDB({
                storeName: 'notes',
                dbVersion: 3,
                keyPath: 'local_id',
                autoIncrement: true,
                indexes: [
                    {name: 'local_id', keyPath: 'local_id', unique: true},
                    {name: 'id', keyPath: 'id', unique: true},
                    {name: 'status', keyPath: 'status', unique: false}
                ]
            }, this);
        },

        url: '/api/collection'
    });

    var collection = new Collection();

    collection.on('idb:ready', function () {
        console.log('idb:ready');
        //collection.create({name: 'Ivan', status: 'UPDATE_FAILED'})
        //collection.firstSync({success: function () { console.log('done', arguments)}, error: function () {console.error(arguments)}})
    })

```