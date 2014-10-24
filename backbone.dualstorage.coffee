  CONSOLE_TAG = "backbone-dualStorage"

  states =
    SYNCHRONIZED: 'SYNCHRONIZED'
    SYNCHRONIZING: 'SYNCHRONIZING'
    UPDATE_FAILED: 'UPDATE_FAILED'
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

    isDelayed: () ->
      @get('status') in [@states.DELETE_FAILED, @states.UPDATE_FAILED]


  Backbone.DualCollection = Backbone.Collection.extend
    states: states

    eventNames: eventNames

    merge: (newData) ->
      newData

    firstSync: (options = {}) ->
      originalSuccess = options.success or $.noop

      syncSuccess = (response) =>
        data = @merge(@parse(response))
        method = if options.reset then 'reset' else 'set';
        @[method](data, options);
        originalSuccess(@, data, options)
        @trigger('sync', @, data, options);
        wrapError(@, options)

      fetchSuccess = () =>
        options.success = syncSuccess
        Backbone.ajaxSync 'read', @, options

      @fetch
        success: fetchSuccess

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

    getDelayedData: (status) ->
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
      do deferred.promise

    save: () ->
      deferred = new $.Deferred()
      @indexedDB.saveAll((-> deferred.resolve()), (-> deferred.reject()))
      do deferred.promise

    markAsSynchronizing: () ->
      models = @filter((item) ->
        do item.isDelayed
      )
      models = _.map(models, (model) =>
        model.set 'status': @states.SYNCHRONIZING
        model.save()
      )
      $.when.apply $, models