(function() {
'use strict';

var objectHasProperties = function(object) {
   for (var iProperty in object) {
      return true;
   }
   return false;
};

var syncScope;

// TODO: clean through instanciation with options
if (typeof window.rootUrl === 'undefined') {
   window.rootUrl = 'commonFramework/';
}

function logError(details) {
   $.post(rootUrl + "sync/jsErrors.php", {"details": details},
      function(data, textStatus) {
      }
   );
}

window.onerror = function(message, file, line) {
  logError(file + ':' + line + '\n\n' + message);
};

// TODO: this doesn't work anymore with angular > 1.3, provide a real module
/*
window.SyncCtrl = function($scope, $timeout) {
   $scope.syncStatus = function() {
      var params = [];
      params[SyncQueue.statusIdle] = { strStatus: "I", color: "green"};
      params[SyncQueue.statusWillSend] = { strStatus: "W", color: "green"};
      params[SyncQueue.statusSending] = { strStatus: "S", color: "blue"};
      params[SyncQueue.statusSendingWillSend] = { strStatus: "S", color: "blue"};

      var statusParams = params[SyncQueue.status];
      if (SyncQueue.nbFailures > 0) {
         statusParams.strStatus = SyncQueue.nbFailures;
         statusParams.color = "red";
      }
      return statusParams;
   };

   $scope.now = ModelsManager.now;

   $scope.ok = function() {
      $scope.showDetails = false;
   };

   $scope.ping = function() {
      $scope.pingStatus = "En cours";
      $scope.lastPingStart = ModelsManager.now();
      $scope.lastPingEnd = $scope.lastPingStart;
      $.get(rootUrl + "sync/ping.php",
          function() {
             $scope.pingStatus = "OK";
             $scope.lastPingEnd = $scope.now();
             $scope.$apply();
          }
      ).fail(function() {
         $scope.pingStatus = "Error";
         $scope.lastPingEnd = $scope.now();
         $scope.$apply();
      });
   };

   $scope.show = function() {
      $scope.showDetails = true;
      $scope.watchIsOnline = false;//watchIsOnline;
      $scope.watchWasOnline = false;//watchWasOnline;
      $scope.ping();
   };
   $scope.testSoundDelayed = function() {
      setTimeout(function() {
         Events.playSound(true);
      }, 100);
      $scope.nbSoundTests++;
   };
   $scope.testSound = function() {
         Events.playSound(true);
         $scope.nbSoundTests++;
   };

   $scope.lastPingStart = null;
   $scope.lastPingEnd = null;
   $scope.pingStatus = "";
   $scope.showDetails = true;//showDetails;
   $scope.syncQueue = SyncQueue;
   $scope.nbSoundTests = 0;
   $scope.lastExecTime = "";
   syncScope = $scope;
   $scope.$on("syncStatusChange", function() {
      $timeout(function(){
          //any code in here will automatically have an apply run afterwards
      });
      //$scope.$apply()
    });
}
*/


window.SyncAlert = {

    element: null,
    interval: null,
    time_counter: 0,
    hide_timeout: null,
    element: null,


    show: function(next_attempt_delay) {
        this.reset();
        if(next_attempt_delay) {
            this.time_counter = next_attempt_delay;
            this.interval = setInterval(this.refreshCounter.bind(this), 1000);
        } else {
            this.time_counter = false;
        }
        this.display(this.time_counter);
        this.getElement().show();
    },


    refreshCounter: function() {
        this.time_counter--;
        if(this.time_counter) {
            this.display(this.time_counter);
        } else {
            this.reset();
            this.hide_timeout = setTimeout(this.hide.bind(this), 100);
        }

    },


    hide: function() {
        this.reset();
        this.getElement().hide();
    },


    reset: function() {
        clearTimeout(this.hide_timeout);
        clearInterval(this.interval);
    },


    display: function(time_counter) {
        this.getElement().find('.counter').toggle(time_counter && time_counter > 0).find('.secs').html(time_counter);
    },


    getElement: function() {
        if(!this.element) {
            this.element = $(
                '<div class="sync-alert">' +
                    '<div class="message">' + i18next.t('commonFramework:connection_error_message') + '</div>' +
                    '<span class="counter">' +
                        i18next.t('commonFramework:connection_error_counter') +
                        ' <span class="secs"></span> ' +
                        i18next.t('commonFramework:connection_error_counter_secs') +
                    '</span> ' +
                    '<a href="#">' + i18next.t('commonFramework:connection_error_try_now') + '</a>' +
                '</div>'
            )
            $(document.body).append(this.element);
            this.element.find('a').click(this.tryNow.bind(this));
        }
        return this.element;
    },


    tryNow: function(e) {
        e.preventDefault();
        window.SyncQueue.resetScheduleSync();
        window.SyncQueue.sync();
        this.hide();
    }

}


window.SyncQueue = {
   modelsManager: null,
   status: 0,
   statusIdle: 0,
   statusWillSend: 1,
   statusSending: 2,
   statusSendingWillSend: 3,
   nbFailures: 0,
   sentVersion: 0,
   serverVersion: 0,
   isApplyingChanges: false,
   requests: {},
   requestSets: {},
   params: {},
   syncStartListeners: {},
   syncEndListeners: {},
   laterSyncEndListeners: {},
   dateLastSync: null,
   dateLastSyncAttempt: null,
   nbSyncs: 0,
   nbSyncsWithoutErrors: 0,
   nbSyncAborted: 0,
   nbFailuresTotal: 0,
   nbFailuresByType: [0, 0, 0, 0],
   callbacks: [],
   laterCallbacks: [],
   nbExceptions: 0,
   numLastAttempt: 0,
   hasSyncedFully: false,
   debugMode: false,

   actionInsert: 1,
   actionUpdate: 2,
   actionDelete: 3,

   objectsToSync: {},
   schedule_sync_timeout: null,

   setStatus: function(status) {
      this.status = status;
      if (syncScope != null) {
         syncScope.$broadcast("syncStatusChange");
      }
   },

   init: function(modelsManager) {
      this.modelsManager = modelsManager;
      for (var modelName in this.modelsManager.models) {
         this.objectsToSync[modelName] = {};
      }
      this.initErrorHandler();
   },

   addSyncStartListeners: function(name, listener) {
      this.syncStartListeners[name] = listener;
   },

   addSyncEndListeners: function(name, listener, safe) {
      if (safe) {
         SyncQueue.syncCheckActive();
         if (SyncQueue.status != SyncQueue.statusIdle) {
            this.laterSyncEndListeners[name] = listener;
            return;
         }
      }
      this.syncEndListeners[name] = listener;
   },

   removeSyncEndListeners: function(name) {
      if (this.syncEndListeners[name]) {
         delete this.syncEndListeners[name];
      }
      if (this.laterSyncEndListeners[name]) {
         delete this.laterSyncEndListeners[name];
      }
   },

   removeSyncStartListeners: function(name) {
      if (this.syncStartListeners[name]) {
         delete this.syncStartListeners[name];
      }
   },

   callSyncStartListeners: function(data) {
      for (var name in this.syncStartListeners) {
         this.syncStartListeners[name](data);
      }
   },

   callSyncEndListeners: function(data) {
      for (var name in this.syncEndListeners) {
         this.syncEndListeners[name](data);
      }
   },

   markStatusArray: function(data, status) {
      for (var objectID in data) {
         data[objectID].status = status;
      }
   },

   markStatus: function(status) {
      for (var modelName in ModelsManager) {
         this.markStatusArray(this.objectsToSync[modelName], status);
      }
   },

   clearStatusArray: function(data) {
      var newData = {};
      for (var objectID in data) {
         if (data[objectID].status !== this.statusSending) {
            newData[objectID] = data[objectID];
         }
      }
      return newData;
   },

   clearStatus: function() {
      for (var modelName in this.objectsToSync) {
         this.objectsToSync[modelName] = this.clearStatusArray(this.objectsToSync[modelName]);
      }
   },

   addObject: function(modelName, sentObject, action, delaySend) {
      if (this.isApplyingChanges) {
         return;
      }
      var modelObjectsToSync = this.objectsToSync[modelName];
      var primaryKey = ModelsManager.getPrimaryKey(modelName);
      var objectToSync;
      if (modelObjectsToSync[sentObject[primaryKey]] === undefined) {
         objectToSync = {action: action, status: this.statusWillSend};
      } else {
         objectToSync = modelObjectsToSync[sentObject[primaryKey]];
         if (action == this.actionInsert) {
            console.error(sentObject);
            console.error("Error: object inserted twice!");
            return;
         }
         switch(objectToSync.action) {
            case this.actionInsert:
               if (action == this.actionDelete) {
                  if (objectToSync.status < this.statusSending) {
                     delete modelObjectsToSync[sentObject[primaryKey]];
                     return;
                     // deleted before it was ever synced
                  }
                  objectToSync.action = action;
               } else {
                  // do nothing now, we'll switch it to update after sync if in statusSendingWillSend
               }
               break;
            case this.actionUpdate:
               if (action == this.actionDelete) {
                  objectToSync.action = action;
               } else {
                  // do nothing now, we'll switch it to update after sync if in statusSendingWillSend
               }
               break;
            case this.actionDelete:
               alert("Error: action on object after it was deleted!");
               return;
               break;
         }
      }
      if (objectToSync.status === this.statusSending) {
         objectToSync.status = this.statusSendingWillSend;
      }
      modelObjectsToSync[sentObject[primaryKey]] = objectToSync;
      if (!delaySend) {
         this.planToSend();
      }
   },

   insert: function(modelName, object) {
      return this.addObject(modelName, object, this.actionInsert);
   },

   deleteRow: function(modelName, object) {
      return this.addObject(modelName, object, this.actionDelete);
   },

   update: function(modelName, object) {
      return this.addObject(modelName, object, this.actionUpdate);
   },

   planToSend: function(delay, callback) {
      SyncQueue.syncCheckActive();
      if (SyncQueue.status === SyncQueue.statusWillSend) {
         if (callback != undefined) {
            SyncQueue.callbacks.push(callback);
         }
         return;
      }
      if (SyncQueue.status === SyncQueue.statusSending) {
         SyncQueue.setStatus(SyncQueue.statusSendingWillSend);
      }
      if (SyncQueue.status === SyncQueue.statusSendingWillSend) {
         if (callback != undefined) {
            SyncQueue.laterCallbacks.push(callback);
         }
         return;
      }
      SyncQueue.setStatus(SyncQueue.statusWillSend);
      if (delay == undefined) {
         delay = 1000;
      }
      setTimeout(function() {
         SyncQueue.sync(callback);
      }, delay);
   },

   updateRequestsVersions: function() {
      for (var iRequestInstance = 0; iRequestInstance < SyncQueue.requestInstancesToSend.length; iRequestInstance++) {
         var requestInstance = SyncQueue.requestInstancesToSend[iRequestInstance];
         requestInstance.minVersion = SyncQueue.serverVersion;
      }
   },

   initRequestsVersions: function() {
      SyncQueue.requestInstancesToSend = [];
      for (var requestName in SyncQueue.requests) {
         var request = SyncQueue.requests[requestName];
         for (var instanceID in request) {
            if (request[instanceID] && typeof request[instanceID] === 'object') {
               if (request[instanceID].resetMinVersion) {
                  request[instanceID].minVersion = 0;
                  delete request[instanceID].resetMinVersion;
               }
               SyncQueue.requestInstancesToSend.push(request[instanceID]);
            }
         }
      }
   },

   initErrorHandler: function() {
      // TODO: call on document for jquery 1.8+
      $(document).ajaxError(function(e, jqxhr, settings, exception) {
        if (settings.url == rootUrl + "sync/syncServer.php") {
            SyncQueue.syncFailed("ajaxError", false, 3);
        }
      });
   },

   syncCheckActive: function() {
      var now = ModelsManager.now();
      if (((SyncQueue.status == SyncQueue.statusSending) || (SyncQueue.status == SyncQueue.statusSendingWillSend) /*|| (SyncQueue.status == SyncQueue.statusWillSend)*/) &&
         SyncQueue.dateLastSyncAttempt && (now.getTime() - SyncQueue.dateLastSyncAttempt.getTime() > 60 * 1000)) {
         SyncQueue.nbSyncAborted++;
         if (SyncQueue.nbSyncAborted == 2) {
            //SyncQueue.showAlert(i18next.t('commonFramework:connection_error_message'));
            SyncAlert.show();
         }
         SyncQueue.status = SyncQueue.statusIdle;
      }
   },

   syncFailed: function(message, retry, failType) {
      if (failType != 3) {
         SyncQueue.nbFailures++;
      }
      SyncQueue.nbFailuresByType[failType]++;
      /*
      if (SyncQueue.nbFailures == 2) {
         SyncQueue.showAlert(i18next.t('commonFramework:connection_error_message'));
      }
      */
      console.error(i18next.t('commonFramework:failure') + " " + SyncQueue.nbFailures + " : " + message);
      var delay = false;
      if (retry) {
         SyncQueue.markStatus(SyncQueue.statusWillSend); // TODO: update
         SyncQueue.setStatus(SyncQueue.statusWillSend);
         delay = Math.min(SyncQueue.nbFailures, 30);
         delay = Math.max(5, delay);
         SyncQueue.scheduleSync(delay);
      }
      SyncAlert.show(delay);
   },


    scheduleSync: function(delay) {
        this.schedule_sync_timeout = setTimeout(SyncQueue.sync, 1000 * delay);
    },


    resetScheduleSync: function() {
        clearTimeout(this.schedule_sync_timeout);
    },


   sync: function(callback) {
      if ((SyncQueue.status == SyncQueue.statusSending) || (SyncQueue.status == SyncQueue.statusSendingWillSend)) {
         SyncQueue.syncCheckActive();
         if (SyncQueue.status != SyncQueue.statusIdle) {
            if (callback != undefined) {
               SyncQueue.laterCallbacks.push(callback);
            }
            return;
         }
      }
      if (callback != undefined) {
         SyncQueue.callbacks.push(callback);
      }
      SyncQueue.numLastAttempt++;
      var numAttempt = SyncQueue.numLastAttempt;
      if (SyncQueue.debugMode) {
         console.log("sync");// + getFrenchTime());
      }
      SyncQueue.markStatus(SyncQueue.statusSending);
      SyncQueue.setStatus(SyncQueue.statusSending);
      var sentChanges = {};
      for (var modelName in ModelsManager.models) {
         var primaryKey = ModelsManager.getPrimaryKey(modelName);
         var toSync = SyncQueue.objectsToSync[modelName];
         if (!objectHasProperties(toSync)) {
            continue;
         }
         sentChanges[modelName] = {inserted: {}, updated: {}, deleted: {} };
         for (var objectID in toSync) {
            var paramsToSync = toSync[objectID];
            var objectToSync;
            paramsToSync.status = SyncQueue.statusSending;
            if (paramsToSync.action != SyncQueue.actionDelete) {
               var record = ModelsManager.getRecord(modelName, objectID);
               if (record == null) {
                  logError("No record " + objectID + " in " + modelName);
                  continue;
               }
               objectToSync = ModelsManager.copyObject(modelName, record);
               objectToSync[primaryKey] = objectID;
            }
            switch(paramsToSync.action) {
               case SyncQueue.actionInsert:
                  sentChanges[modelName].inserted[objectID] = { data: ModelsManager.convertToSql(modelName, objectToSync) };
                  break;
               case SyncQueue.actionUpdate:
                  sentChanges[modelName].updated[objectID] = { data: ModelsManager.convertToSql(modelName, objectToSync) };
                  break;
               case SyncQueue.actionDelete:
                  sentChanges[modelName].deleted[objectID] = { data: true };
                  break;
            }
         }
      }
      SyncQueue.initRequestsVersions();
      if (SyncQueue.debugMode) {
         console.log("Changes sent : " + JSON.stringify(sentChanges));
         console.log("requests : " + JSON.stringify(SyncQueue.requests));
         console.log("requestSets : " + JSON.stringify(SyncQueue.requestSets));
         console.log("minServerVersion : " + SyncQueue.serverVersion);
      }
      var params = { requests: SyncQueue.requests };
      for (var paramName in SyncQueue.params) {
         params[paramName] = SyncQueue.params[paramName];
      }
      SyncQueue.dateLastSyncAttempt = ModelsManager.now();
      SyncQueue.lastExecTime = "";
      $.ajax({
         type: "POST",
         url: rootUrl + "sync/syncServer.php",
         data: {
            "minServerVersion": SyncQueue.serverVersion,
            "params": JSON.stringify(params),
            "requestSets": JSON.stringify(SyncQueue.requestSets),
            "changes": JSON.stringify(sentChanges)
         }, // TODO sentChanges may need a lookup (when used in first, prevents the other properties from appearing)
         timeout: 60000,
         success: function(data) {
            try {
               SyncQueue.dateLastSync = ModelsManager.now();
               SyncQueue.nbSyncs++;
               if (SyncQueue.nbFailures == 0) {
                  SyncQueue.nbSyncsWithoutErrors++;
               } else {
                  SyncQueue.nbFailuresTotal += SyncQueue.nbFailures;
               }
               try {
                  data = $.parseJSON(data);
                  if (SyncQueue.debugMode) {
                     console.log(data);
                  }
               } catch(exception) {
                  SyncQueue.syncFailed(data, (numAttempt == SyncQueue.numLastAttempt), 1);
                  return;
               }
               SyncQueue.callSyncStartListeners(data);
               SyncQueue.lastExecTime = data.execTime;

               ModelsManager.updateDateDiffWithServer(data.serverDateTime);
               SyncQueue.applyChanges(data.changes);
               SyncQueue.updateCounts(data.counts);
               SyncQueue.nbFailures = 0;
               SyncQueue.clearStatus();
               if ((SyncQueue.status === SyncQueue.statusSendingWillSend) || data.continued) {
                  SyncQueue.scheduleSync(1);
                  SyncQueue.setStatus(SyncQueue.statusWillSend);
                  if (SyncQueue.debugMode) {
                     console.log("back to willSend");
                  }
               } else {
                  if (SyncQueue.debugMode) {
                     console.log("back to idle");
                  }
                  SyncQueue.setStatus(SyncQueue.statusIdle);
               }
               ModelsManager.sortAllMarked();
               ModelsManager.invokeAllSafeListeners();
               SyncQueue.callSyncEndListeners(data);
               for (var listenerName in SyncQueue.laterSyncEndListeners) {
                  SyncQueue.syncEndListeners[listenerName] = SyncQueue.laterSyncEndListeners[listenerName];
                  delete SyncQueue.laterSyncEndListeners[listenerName];
               }
               SyncQueue.serverVersion = SyncQueue.resetSync ? 0 : data.serverVersion;
               if (!data.continued) {
                  SyncQueue.hasSyncedFully = true;
               }
               SyncQueue.resetSync = false;
               SyncQueue.updateRequestsVersions();
               var oldCallbacks = SyncQueue.callbacks;
               SyncQueue.callbacks = SyncQueue.laterCallbacks;
               SyncQueue.laterCallbacks = [];
               for (var iCallback = 0; iCallback < oldCallbacks.length; iCallback++) {
                  try {
                     oldCallbacks[iCallback]();
                  } catch(exception) {
                     SyncQueue.nbExceptions++;
                  }
               }
            } catch (exception) {
               console.error(i18next.t('commonFramework:sync_error_message') + "\n" + exception.message + "\n" + exception.stack);
               SyncQueue.syncFailed(i18next.t('commonFramework:sync_error'), (numAttempt == SyncQueue.numLastAttempt), 2);
            }
         },
         error: function(request, status, err) {
            SyncQueue.syncFailed(status, (numAttempt == SyncQueue.numLastAttempt), 0);
         }
      });
   },
   applyUpdates: function(modelName, rows, requestSetName) {
      var modelObjectsToSync = this.objectsToSync[modelName];
      for (var recordID in rows) {
         // We ignore changes from the server if we have local changes on the same record.
         var objectToSync = modelObjectsToSync[recordID];
         if ((objectToSync == undefined) || (objectToSync.status == this.statusSending)) {
            if (this.modelsManager.oldData[modelName][recordID] != undefined) {
               this.modelsManager.updateFromRowOfStrings(modelName, rows[recordID].data, requestSetName);
            } else {
               this.modelsManager.insertFromRowOfStrings(modelName, rows[recordID].data, requestSetName);
            }
         } else {
            console.log("ignored update from the server");
         }
      }
   },

   applyDeletes: function(modelName, IDs, requestSetName) {
      for (var recordID in IDs) {
         this.modelsManager.deleteRecord(modelName, recordID, requestSetName);
      }
   },

   updateCounts: function(counts) {
      if (Array.isArray(counts)) {
         return;
      }
      this.isApplyingChanges = true;
      for (var requestName in counts) {
         var requestCount = counts[requestName];
         if (this.modelsManager.counts[requestName] == undefined) {
            this.modelsManager.counts[requestName] = 0;
         }
         this.modelsManager.counts[requestName] += requestCount.inserted - requestCount.deleted;
      }
      this.isApplyingChanges = false;
   },

   innerApplyChanges: function(modelName, modelChanges, requestSetName) {
      if (modelChanges != undefined) {
         if (!Array.isArray(modelChanges.inserted)) {
            this.applyUpdates(modelName, modelChanges.inserted, requestSetName);
         }
         if (!Array.isArray(modelChanges.updated)) {
            this.applyUpdates(modelName, modelChanges.updated, requestSetName);
         }
         if (!Array.isArray(modelChanges.deleted)) {
            this.applyDeletes(modelName, modelChanges.deleted, requestSetName);
         }
      }
   },

   applyChanges: function(changes) {
      this.isApplyingChanges = true;
      for (var modelName in this.modelsManager.models) {
         if (modelName == "requestSets") continue;
         this.innerApplyChanges(modelName, changes[modelName.toLowerCase()], 'default');
         for (var requestSetName in changes.requestSets) {
            var requestSet = changes.requestSets[requestSetName];
            if (requestSet[modelName.toLowerCase()] != undefined) {
               this.innerApplyChanges(modelName, requestSet[modelName.toLowerCase()], requestSetName);
            }
         }
      }
      this.isApplyingChanges = false;
   },
};

})();
