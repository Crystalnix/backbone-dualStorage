  class BackboneIndexedDB
    states:
      SYNCHRONIZED: 'SYNCHRONIZED'
      SYNCHRONIZING: 'SYNCHRONIZING'
      UPDATE_FAILED: 'UPDATE_FAILED'
      DELETE_FAILED: 'DELETE_FAILED'

    eventNames:
      LOCAL_SYNC_FAIL: 'LOCAL_SYNC_FAIL'
      LOCAL_SYNC_SUCCESS: 'LOCAL_SYNC_SUCCESS'
      REMOTE_SYNC_FAIL: 'REMOTE_SYNC_FAIL'
      REMOTE_SYNC_SUCCESS: 'REMOTE_SYNC_SUCCESS'
      SYNCHRONIZED: 'SYNCHRONIZED'

    constructor: (options, parent) ->
      @parent = parent # reference to the model or collection
      defaultReadyHandler = =>
        @parent.trigger "idb:ready", @

      defaultErrorHandler = (error) ->
        throw error

      defaults =
        storeName: "Store"
        storePrefix: ""
        dbVersion: 1
        keyPath: "local_id"
        autoIncrement: true
        onStoreReady: defaultReadyHandler
        onError: defaultErrorHandler
        indexes: [{ name: 'id', keyPath: 'id', unique: true, multiEntry: false }]

      options = _.defaults(options or {}, defaults)
      @dbName = options.storePrefix + options.storeName
      @store = new IDBStore(options)

    wrapStoreCallForDeferred: (method, data) ->
      deferred = new $.Deferred()
      success = (result) ->
        deferred.resolve(result)
      fail = (result) ->
        deferred.reject(result)
      method.call @store, data, success, fail
      do deferred.promise

    create: (data) ->
      @wrapStoreCallForDeferred @store.put, data

    update: (data) ->
      @wrapStoreCallForDeferred @store.put, data

    read: (id) ->
      @wrapStoreCallForDeferred @store.get, id

    destroy: (id) ->
      @wrapStoreCallForDeferred @store.remove, id

    saveAll: (data) ->
      @wrapStoreCallForDeferred @store.putBatch, data

    getAll: () ->
      @wrapStoreCallForDeferred @store.getAll

    deleteDatabase: () ->
      @wrapStoreCallForDeferred @store.deleteDatabase

    merge: (oldData, newData) ->
      newData

    asd:
      'read': ['fetchRemote', 'fetchLocal', 'merge', 'saveInLocal']

    flagsForFailedRemoteSync:
      'read': undefined
      'create': @states.UPDATE_FAILED
      'update': @states.UPDATE_FAILED
      'delete': @states.DELETE_FAILED

    removeGarbage: () ->
      deferred = new $.Deferred()
      idsForRemove = []
      status = @states.SYNCHRONIZING
      options =
        onEnd: =>
          @store.removeBatch idsForRemove, (-> deferred.resolve(arguments)), (-> deferred.reject(arguments))
      @store.iterate((data)->
        if data.status is status
          idsForRemove.push data.local_id
      , options)
      do deferred.promise

    sync: (method, model, options) ->
      event = _.extend {}, Backbone.Events
      originalSuccess = options.success or $.noop
      originalError = options.error or $.noop
      model.status = @states.SYNCHRONIZING
      merge = model.merge or @merge

      options.error = (response) =>
        model.status = @flagsForFailedRemoteSync[method]
        @update(model.toJSON()).done =>
          event.trigger @eventNames.REMOTE_SYNC_FAIL, response
          originalError.apply @, arguments
          event.trigger @eventNames.SYNCHRONIZED
      options.success = (response) =>
        model.status = @states.SYNCHRONIZED
        data = merge.call @, model.toJSON(), response
        @update(data).done =>
          event.trigger @eventNames.REMOTE_SYNC_SUCCESS, _.extend({}, response)
          originalSuccess.call @, data
          @removeGarbage().done(=> event.trigger(@eventNames.SYNCHRONIZED))


      db = model.indexedDB or model.collection.indexedDB;
      localMethod = method
      if method == 'read' and not model.id then localMethod = 'getAll'
      if method in ['read', 'destroy']
        data = model.id
      else if method in ['create', 'update']
        data = model.toJSON()
        data.status = model.status

      db[method](data).fail((result) =>
        event.trigger @eventNames.LOCAL_SYNC_FAIL, result
      ).done((result)=>
        event.trigger @eventNames.LOCAL_SYNC_SUCCESS, result
      ).done((result)=>
        if not options.attrs and model.getDataForRemoteSync then options.attrs = model.getDataForRemoteSync()
        Backbone.sync.call(@, method, model, options)
      )

      event