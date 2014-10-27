  CONSOLE_TAG = "backbone-dualStorage"

  states =
    SYNCHRONIZED: 'SYNCHRONIZED'
    SYNCHRONIZING: 'SYNCHRONIZING'
    UPDATE_FAILED: 'UPDATE_FAILED'
    CREATE_FAILED: 'CREATE_FAILED'
    DELETE_FAILED: 'DELETE_FAILED'

  eventNames =
    LOCAL_SYNC_FAIL: 'LOCAL_SYNC_FAIL'
    LOCAL_SYNC_SUCCESS: 'LOCAL_SYNC_SUCCESS'
    REMOTE_SYNC_FAIL: 'REMOTE_SYNC_FAIL'
    REMOTE_SYNC_SUCCESS: 'REMOTE_SYNC_SUCCESS'
    SYNCHRONIZED: 'SYNCHRONIZED'

  wrapError = (model, options) ->
    error = options.error;
    options.error = (resp) ->
      if (error) then error(model, resp, options)
      model.trigger('error', model, resp, options)


  Backbone.DualModel = Backbone.Model.extend
    states: states,

    remoteIdAttribute: 'id',

    getUrlForSync: (urlRoot, method) ->
      remoteId = @get(@remoteIdAttribute)
      if remoteId and method in ['update', 'delete']
        return "#{urlRoot}/#{remoteId}/"
      return urlRoot

    isInSynchronizing: () ->
      @get('status') is @states.SYNCHRONIZING

    isDelayed: () ->
      @get('status') in [@states.DELETE_FAILED, @states.UPDATE_FAILED]

  Backbone.IndexedDB.prototype.create = (model, options) ->
    model.set('status', states.CREATE_FAILED)
    data = model.attributes;
    @store.put(data, (insertedId) =>
      data[@keyPath] = insertedId;
      options.success(data)
    , options.error);

  Backbone.IndexedDB.prototype.update = (model, options) ->
    model.set('status', states.UPDATE_FAILED)
    data = model.attributes
    @store.put(data, options.success, options.error);

  Backbone.IndexedDB.prototype.getAll = (options) ->
    data = []
    @iterate((item) ->
      if item.status != states.DELETE_FAILED
        data.push(item)
    , onEnd: () ->options.success(data))

  Backbone.IndexedDB.prototype.destroy = (model, options) ->
    if model.isNew()
      return false
    model.set('status', states.DELETE_FAILED)
    data = model.attributes
    @store.put(data, options.success, options.error)


  Backbone.DualCollection = Backbone.Collection.extend
    states: states

    eventNames: eventNames

    getSyncMethodsByState: (state) ->
      method = switch
        when @states.CREATE_FAILED is state then 'create'
        when @states.UPDATE_FAILED is state then 'update'
        when @states.DELETE_FAILED is state then 'delete'

    merge: (newData) ->
      newData

    firstSync: (options = {}) ->
      originalSuccess = options.success or $.noop
      event = _.extend {}, Backbone.Events
      syncSuccess = (response) =>
        data = @merge(@parse(response))
        event.trigger(@eventNames.REMOTE_SYNC_SUCCESS)
        method = if options.reset then 'reset' else 'set';
        @[method](data, options);
        originalSuccess(@, data, options)
        @trigger('sync', @, data, options);
        wrapError(@, options)

      syncError = (error) =>
        event.trigger(@eventNames.REMOTE_SYNC_FAIL, error, options)


      fetchSuccess = (data) =>
        options.success = syncSuccess
        options.error = syncError
        event.trigger(@eventNames.LOCAL_SYNC_SUCCESS, data)
        Backbone.ajaxSync 'read', @, options

      @fetch
        success: fetchSuccess
        error: (error) ->
          event.trigger(@eventNames.LOCAL_SYNC_FAIL, error)

      return event

    removeGarbage: () ->
      deferred = new $.Deferred()
      idsForRemove = []
      status = @states.SYNCHRONIZING
      options =
        onEnd: =>
          @indexedDB.removeBatch idsForRemove, (-> deferred.resolve(arguments)), (-> deferred.reject(arguments))
      @indexedDB.iterate((data)->
        if data.status is status
          idsForRemove.push data.local_id
      , options)
      do deferred.promise

    _getDelayedData: (status) ->
      deferred = new $.Deferred()
      data = []
      keyRange = @indexedDB.makeKeyRange
        lower: status
        upper: status
      options =
        index: 'status'
        keyRange: keyRange
        onEnd: () ->
          deferred.resolve(data)
      @indexedDB.iterate((item) ->
        data.push(item)
      , options)
      deferred.promise()

    getDelayedData: () ->
      deferred = new $.Deferred()
      deleted = @_getDelayedData(@states.DELETE_FAILED)
      created = @_getDelayedData(@states.CREATE_FAILED)
      updated = @_getDelayedData(@states.UPDATE_FAILED)
      $.when(deleted, created,updated).done((a, b, c) ->
        deferred.resolve(_.union(a, b, c))
      )
      deferred.promise()

    fullSync: () ->
      deferred = new $.Deferred()
      @getDelayedData().done((delayedData)=>
        console.log CONSOLE_TAG, 'fullsync', delayedData
        count = 0
        done = () =>
          count++
          if count is delayedData.length
            Backbone.ajaxSync('read', @, success: (response) =>
              data = @parse(response)
              @set(data, silent: yes)
              @markAsSynchronizing(delayedData).done(@removeGarbage().done(->deferred.resolve()))
            , error: -> deferred.reject())

        _.each(delayedData, (item) =>
          method = @getSyncMethodsByState(item.status)
          delete item.status
          model = new @model(item)
          console.log CONSOLE_TAG, 'full sync model', item, method
          model.url = model.getUrlForSync(_.result(@, 'url'), method)

          Backbone.ajaxSync(method, model, success: done, error: done)
        )
      )

      deferred.promise()

    save: () ->
      deferred = new $.Deferred()
      @indexedDB.saveAll((-> deferred.resolve()), (-> deferred.reject()))
      do deferred.promise

    markAsSynchronizing: (delayedData) ->
      deferred = new $.Deferred()

      map = (item) =>
        item.status = @states.SYNCHRONIZING
        deferred = new $.Deferred()
        @indexedDB.store.put(item, (-> deferred.resolve()), (->deferred.reject()))
        deferred.promise()

      console.log CONSOLE_TAG, 'start to mark as synchronizing', delayedData
      deferreds = _.map(delayedData, map)
      $.when.apply($, deferreds).done(->
        console.log CONSOLE_TAG, 'mark successful', delayedData
        deferred.resolve(delayedData)
      ).fail(->console.warn CONSOLE_TAG, 'could not mark as sync', arguments)

      deferred.promise()
