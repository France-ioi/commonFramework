"use strict";

// depends on jQuery, jquery-dynatree, shared/utils.js and optionnaly jquery-contextmenu

window.TreeView = Class.extend({
   init: function(name, commonData, params) {
      this.commonData = commonData;
      this.currentKey = 0;
      this.name = name;
      this.staticData = (typeof params.staticData === 'undefined') ? false : params.staticData;
      this.clickFolderMode = (typeof params.clickFolderMode === 'undefined') ? 1 : params.clickFolderMode;
      this.selectMode = (typeof params.selectMode === 'undefined') ? 1 : params.selectMode;
      this.readOnly = (typeof params.readOnly === 'undefined') ? false : params.readOnly;
      this.displayUnused = (typeof params.displayUnused === 'undefined') ? true : params.displayUnused;
      this.checkUserRight = (typeof params.checkUserRight === 'undefined') ? function(){return true;} : params.checkUserRight;
      this.onQuerySelect = (typeof params.onQuerySelect === 'undefined') ? null : params.onQuerySelect;
      this.onQueryActivate = (typeof params.onQueryActivate === 'undefined') ? null : params.onQueryActivate;
      this.objectsModelName = params.objectsModelName;
      this.objectsStringsModelName = params.objectsStringsModelName;
      this.objectFieldName = params.objectFieldName;
      this.relationsModelName = params.relationsModelName;
      this.idChildFieldName = params.idChildFieldName;
      this.idParentFieldName = params.idParentFieldName;
      this.parentFieldName = params.parentFieldName;
      this.childFieldName = params.childFieldName;
      this.iChildOrderFieldName = params.iChildOrderFieldName;
      this.parentsFieldName = params.parentsFieldName;
      this.childrenFieldName = params.childrenFieldName;
      this.childrenFixedRanksName = params.childrenFixedRanksName;
      this.forceRoot = params.isObjectRoot;
      this.isObjectRoot = params.isObjectRoot;
      this.getObjectTitle = params.getObjectTitle;
      this.objectSelected = params.objectSelected;
      this.objectExpanded = params.objectExpanded;
      this.objectFilter = params.objectFilter;
      this.relationFilter = params.relationFilter;
      this.selectedRelationID = null;
      this.relationSelected = function(relationID, ancestors) {
         this.selectedRelationID = relationID;
         params.relationSelected(relationID, ancestors);
      };
      this.compareRelations = params.compareRelations;
      this.createChild = params.createChild;
      this.deleteRelation = params.deleteRelation;
      this.relationCreated = params.relationCreated;
      this.isVisibleObject = params.isVisibleObject;
      this.isVisibleRelation = params.isVisibleRelation;
      var that = this;
      this.relationsKeys = {};
      this.triggers = {
         syncStarted: function() {
            var tree = $("#" + that.name).dynatree("getTree");
            tree.enableUpdate(false);
            that.willFillStaticData = true;
            SyncQueue.removeSyncStartListeners(that.name);
         },

         syncEnded: function() {
            var tree = $("#" + that.name).dynatree("getTree");
            that.fillWithStaticData();
            that.willFillStaticData = false;
            tree.enableUpdate(true);
            SyncQueue.removeSyncEndListeners(that.name);
         },

         relationDeleted: function(relation) {
            var relationKeys = that.relationsKeys[relation.ID];
            if (relationKeys) {
               for (var iKey = 0; iKey < relationKeys.length; iKey++) {
                  var oldNode = that.getNodeByKey(relationKeys[iKey]);
                  if (oldNode) {
                     oldNode.remove();
                  }
               }
               delete that.relationsKeys[relation.ID];
            }
            var child = ModelsManager.getRecord(that.objectsModelName, relation[that.idChildFieldName]);
            if (child) {
               that.triggers.objectUpdated(child);
            }
         },

         // on insère un objet sous la racine
         // il faut mettre à jour toutes les occurences du noeud racine dans l'arbre
         // ce sont tous les relations qui ont pour fils la racine.
         // pb : il n'y en a aucun
         relationInserted: function(relation, doingStaticData) {
            if (that.willFillStaticData && !doingStaticData) return;
            if ((that.isVisibleObject && (!that.isVisibleObject(relation[that.childFieldName]))) ||
               (that.isVisibleRelation && (!that.isVisibleRelation(relation)))) {
               return;
            }
            if (that.relationFilter && !that.relationFilter(relation)) {
               return;
            }
            var iKey, parentNode;
            var parents = relation[that.parentFieldName][that.parentsFieldName];
            if(that.relationsKeys[relation.ID]) {
               return;
            }
            for (var iParent in parents) {
               var parentRelation = parents[iParent];
               var parentKeys = that.relationsKeys[parentRelation.ID];
               if (parentKeys) {
                  for (iKey = 0; iKey < parentKeys.length; iKey++) {
                     parentNode = that.getNodeByKey(parentKeys[iKey]);
                     if (parentNode) {
                        parentNode.addChild(that.getTreeFromRelation(relation));
                        parentNode.render(false, true); // Otherwise there is a bug (node.li is null) when we add children
                        if (that.compareRelations) {
                           parentNode.sortChildren(that.compareNodes);
                        }
                     }
                  }
               }
            }
            var unusedKeys = that.relationsKeys["unused_" + relation[that.parentFieldName].ID];
            if (unusedKeys) {
               for (iKey = 0; iKey < unusedKeys.length; iKey++) {
                  parentNode = that.getNodeByKey(unusedKeys[iKey]);
                  if (parentNode) {
                     parentNode.addChild(that.getTreeFromRelation(relation));
                     parentNode.render(false, true); // Otherwise there is a bug (node.li is null) when we add children
                     if (that.compareRelations) {
                        parentNode.sortChildren(that.compareNodes);
                     }
                  }
               }
            }
            if (that.isObjectRoot(relation[that.parentFieldName])) {
               var rootNode = $("#" + that.name).dynatree("getRoot");
               rootNode.addChild(that.getTreeFromRelation(relation));
               rootNode.render(false, true); // Otherwise there is a bug (node.li is null) when we add children
               if (that.compareRelations) {
                  rootNode.sortChildren(that.compareNodes);
               }
               if (that.objectExpanded) {
                  that.objectExpanded(relation[that.idParentFieldName]);
               }
            }
            that.triggers.objectUpdated(relation[that.childFieldName]);
         },

         relationUpdated: function(relation, oldData, forceUpdate) {
            if ((relation[that.idParentFieldName] === oldData[that.idParentFieldName]) &&
               (relation[that.idChildFieldName] === oldData[that.idChildFieldName]) &&
               (relation[that.iChildOrderFieldName] === oldData[that.iChildOrderFieldName]) &&
               (!forceUpdate)) {
               return;
            }
            that.triggers.relationDeleted(relation);
            that.triggers.relationInserted(relation);
            if (that.isVisibleObject && (!that.isVisibleObject(relation[that.childFieldName]))) {
               return;
            }
            if (that.isVisibleRelation && (!that.isVisibleRelation(relation))) {
               return;
            }
            if (that.relationFilter && !that.relationFilter(relation)) {
               return;
            }
            that.triggers.objectUpdated(relation[that.childFieldName]);
         },

         objectUpdated: function(object, doingStaticData) {
            if (that.willFillStaticData && !doingStaticData) return;
            if (that.isObjectRoot(object)) {
               return;
            }
            if (that.objectFilter && !that.objectFilter(object)) {
               return;
            }
            var parentNode;
            var unusedKeys = that.relationsKeys["unused_" + object.ID];
            if (unusedKeys && unusedKeys[0]) {
               if (that.displayUnused) {
                  var unusedNode = that.getNodeByKey(unusedKeys[0]);
                  if (objectHasProperties(object[that.parentsFieldName])) {
                     that.relationsKeys["unused_" + object.ID] = [];
                     if (unusedNode.li) {
                        unusedNode.remove();
                     }
                  } else {
                     unusedNode.data.title = that.getObjectTitle(object);
                     unusedNode.render();
                  }
               }
            } else if (!objectHasProperties(object[that.parentsFieldName]) && that.displayUnused) {
               parentNode = that.getNodeByKey("unused");
               var objectTitle = that.getObjectTitle(object);
               var childNode = that.getTree(object, objectTitle, "unused_" + object.ID);
               childNode.idObject = object.ID;
               parentNode.addChild(childNode);
            }
            for (var iParent in object[that.parentsFieldName]) {
               var parentRelation = object[that.parentsFieldName][iParent];
               if (that.relationFilter && !that.relationFilter(parentRelation)) {
                  continue;
               }
               var parentKeys = that.relationsKeys[parentRelation.ID];
               if (parentKeys) {
                  for (var iKey = 0; iKey < parentKeys.length; iKey++) {
                     parentNode = that.getNodeByKey(parentKeys[iKey]);
                     if (parentNode) {
                        parentNode.data.title = that.getRelationTitle(parentRelation);
                        parentNode.render();
                     }
                  }
               }
            }
         },

         objectStringsUpdated: function(objectString, doingStaticData) {
            that.triggers.objectUpdated(objectString[that.objectFieldName], doingStaticData);
         }
      };

      this.fillWithStaticData = function() {
         var records = ModelsManager.getRecords(that.relationsModelName);
         $.each(records, function(ID, record) {
            that.triggers.relationInserted(record, true);
         });
         /*records = ModelsManager.getRecords(that.objectsModelName);
         $.each(records, function(ID, record) {
            that.triggers.objectUpdated(record);
         });*/
         if (that.objectsStringsModelName) {
            records = ModelsManager.getRecords(that.objectsStringsModelName);
            $.each(records, function(ID, record) {
               that.triggers.objectStringsUpdated(record, true);
            });
         }
      };

      this.compareNodes = function(nodeA, nodeB) {
         return that.compareNodesData(nodeA.data, nodeB.data, nodeA, nodeB);
      };
      this.compareNodesData = function(dataA, dataB, nodeA, nodeB) {
         if (dataA.key == "unused") {
            return 1;
         }
         if (dataB.key == "unused") {
            return -1;
         }
         var relationA = ModelsManager.getRecord(that.relationsModelName, dataA.idRelation);
         var relationB = ModelsManager.getRecord(that.relationsModelName, dataB.idRelation);
         if (!relationA || !relationB) {
            console.error("cannot find relations with ID "+dataA.idRelation+" or "+dataB.idRelation);
            return -1;
         }
         return that.compareRelations(relationA, relationB);
      };
      this.activateRelation = function(relation) {
         var tree = $("#" + that.name).dynatree("getTree");
         var keys = that.relationsKeys[relation.ID];
         var node = that.getNodeByKey(keys[keys.length - 1]);
         var key = node.data.key;
         tree.activateKey(key);
      };
   },

   getRelationTitle: function(relation, noHtml) {
      var title = this.getObjectTitle(relation[this.childFieldName], relation, noHtml);
      var res = relation[this.iChildOrderFieldName] + ": " + title;
      return res;
   },

   getTree: function(childObject, title, relationID, depth) {
      if (!depth) {
         depth = 0;
      }
      this.currentKey++;
      var treeNode = {
         title: title,
         isFolder: true,
         key: this.currentKey.toString(),
         children: [],
         idRelation: relationID
      };
      if (!this.relationsKeys[relationID]) {
         this.relationsKeys[relationID] = [];
      }
      this.relationsKeys[relationID].push(this.currentKey);
      if (depth > 50) {
         alert(i18next.t('commonFramework:treeview_too_deep') + " (" + depth + ") ! relationID : " + relationID);
      }
      var children = childObject[this.childrenFieldName] || [];
      for (var iChild = 0; iChild < children.length; iChild++) {
         if ((this.isVisibleObject && (!this.isVisibleObject(children[iChild][this.childFieldName]))) ||
            (this.isVisibleRelation && (!this.isVisibleRelation(children[iChild])))) {
            continue;
         }
         if (this.relationFilter && !this.relationFilter(children[iChild])) {
            continue;
         }
         var childNode = this.getTreeFromRelation(children[iChild], depth + 1);
         treeNode.children.push(childNode);
      }
      if (this.compareRelations) {
         treeNode.children.sort(this.compareNodesData);
      }
      return treeNode;
   },

   getTreeFromRelation: function(relation, depth) {
      var childObject = relation[this.childFieldName];
      var title = this.getRelationTitle(relation);
      return this.getTree(childObject, title, relation.ID, depth);
   },
   deselectNode: function() {
      this.relationSelected(null, null);
   },
   selectNode: function(node) {
      if (node.data.idObject) {
         this.objectSelected(node.data.idObject);
      } else {
         var ancestors = [];
         var curNode = node;
         while (curNode.data.idRelation) {
            ancestors.push(curNode.data.idRelation);
            curNode = curNode.parent;
         }
         this.relationSelected(node.data.idRelation, ancestors);
      }
   },
   expandNode: function(flag, node) {
      if (!flag || !this.objectExpanded) {
         return;
      }
      if (node.data.idObject) {
         this.objectExpanded(node.data.idObject);
      } else {
         var relation = ModelsManager.getRecord(this.relationsModelName, node.data.idRelation);
         if (relation) {
            this.objectExpanded(relation[this.idChildFieldName]);
         }
      }
   },
   /*
      locateObject: function(event, id) {
         var tree = $("#" + this.name).dynatree("getTree");
         tree.activateKey(id);
         this.selectObject(id);
      },
   */
   getNodeByKey: function(key) {
      return $("#" + this.name).dynatree("getTree").getNodeByKey(key.toString());
   },

   doDeleteRelation: function(relation) {
      var iChildOrder = relation[this.iChildOrderFieldName];
      var parent = relation[this.parentFieldName];
      if (typeof this.deleteRelation === 'function') {
         this.deleteRelation(relation);
         this.triggers.relationDeleted(relation);
      } else {
         ModelsManager.deleteRecord(this.relationsModelName, relation.ID);
      }
      this.changeChildrenOrderBetween(parent, -1, iChildOrder + 1);
      this.cleanupOrders(parent);
   },

   deleteObjectFromNode: function(node) {
      if (!node) {
         alert(i18next.t('commonFramework:treeview_no_object_selected'));
         return false;
      }
      if (node.parent == null) {
         alert(i18next.t('commonFramework:treeview_unable_remove_root'));
         return false;
      }
      if (node.data.idObject) {
         alert(i18next.t('commonFramework:treeview_unable_remove_there')); // TODO : don't show in contextMenu !
         return false;
      }
      var relation = ModelsManager.getRecord(this.relationsModelName, node.data.idRelation);
      if (!this.checkUserRight(relation.ID, this.relationsModelName, 'delete')) {
         alert(i18next.t('commonFramework:treeview_unable_remove_rights')); // TODO : don't show in contextMenu !
         return false;
      }
      var objectParent = relation[this.parentFieldName];
      var confirmMsg = i18next.t('commonFramework:treeview_confirm_remove')
         + ' "' + this.getRelationTitle(relation, true) + '" '
         + i18next.t('commonFramework:treeview_confirm_remove_from')
         + ' "' + this.getObjectTitle(objectParent, true, true) + '" ?';
      if (!confirm(confirmMsg)) {
         return false;
      }
      if (this.selectedRelationID == node.data.idRelation) {
         this.deselectNode();
      }
      this.doDeleteRelation(relation);
      return true;
   },

   copyRelation: function(node, cut) {
      var relation = ModelsManager.getRecord(this.relationsModelName, node.data.idRelation);
      if (cut) {
         if (!this.deleteObjectFromNode(node)) {
            return false;
         }
      }
      this.commonData.copiedRelation = relation;
   },

   pasteRelation: function(targetNode) {
      var relation = this.commonData.copiedRelation;
      if (relation == null) {
         alert(i18next.t('commonFramework:treeview_no_object_copied'));
         return false;
      }
      var targetRelation = ModelsManager.getRecord(this.relationsModelName, targetNode.data.idRelation);
      var newRelation = ModelsManager.createRecord(this.relationsModelName);
      newRelation[this.idChildFieldName] = relation[this.childFieldName].ID;
      newRelation[this.idParentFieldName] = targetRelation[this.childFieldName].ID;
      newRelation[this.iChildOrderFieldName] = this.firstAvailableOrder(targetRelation[this.childFieldName]);
      ModelsManager.insertRecord(this.relationsModelName, newRelation);
      this.cleanupOrders(targetRelation[this.parentFieldName]);
      alert(i18next.t('commonFramework:treeview_warning_access'));
   },

   cleanupOrders: function(parentObject) {
      if(this.childrenFixedRanksName && parentObject[this.childrenFixedRanksName]) {
         return;
      }
      var childrenIDsSorted = [];
      var children = parentObject[this.childrenFieldName];
      var that = this;
      $.each(children, function(iChild, childRelation) {
         childrenIDsSorted.push({
            ID: childRelation.ID,
            order: childRelation[that.iChildOrderFieldName],
            iChild: iChild
         });
      });
      childrenIDsSorted.sort(function(childIDA, childIDB) {
         return childIDA.order - childIDB.order;
      });
      for (var iChildID = 0; iChildID < childrenIDsSorted.length; iChildID++) {
         var childID = childrenIDsSorted[iChildID];
         var relation = children[childID.iChild];
         if (relation[this.iChildOrderFieldName] != iChildID+1) {
            relation[this.iChildOrderFieldName] = iChildID+1;
            ModelsManager.updated(this.relationsModelName, relation.ID);
         }
      }
   },

   firstAvailableOrder: function(parentObject) {
      var firstAvailable;
      if (this.childrenFixedRanksName && parentObject[this.childrenFixedRanksName]) {
         // Object has fixed ranks for the children, all new children are
         // assigned 0 as rank
         return 0;
      }
      if (typeof parentObject[this.childrenFieldName] === 'object') {
         firstAvailable = Object.keys(parentObject[this.childrenFieldName]).length+1;
      } else {
         firstAvailable = parentObject[this.childrenFieldName].length+1;
      }
      return firstAvailable;
   },

   changeChildrenOrderBetween: function(object, delta, beginOrder, endOrder) {
      if(this.childrenFixedRanksName && object[this.childrenFixedRanksName]) {
         return;
      }
      var that = this;
      var children = object[this.childrenFieldName];
      var maxOrder = 0;
      var minOrder = 1000000000;
      var iRelation, relation;
      $.each(children, function(iRelation, relation) {
         var relationOrder = relation[that.iChildOrderFieldName];
         if (relationOrder > maxOrder) {
            maxOrder = relationOrder;
         }
         if (relationOrder < minOrder) {
            minOrder = relationOrder;
         }
      });
      if (endOrder === undefined) {
         endOrder = maxOrder + 1;
      }
      if (beginOrder === undefined) {
         beginOrder = minOrder;
      }
      $.each(children, function(iRelation, relation) {
         var prevOrder = relation[that.iChildOrderFieldName];
         if ((prevOrder >= beginOrder) && (prevOrder < endOrder)) {
            relation[that.iChildOrderFieldName] = relation[that.iChildOrderFieldName]+delta;
            ModelsManager.updated(that.relationsModelName, relation.ID);
         }
      });
   },

   debugChildOrder : function(object) {
      var that = this;
      var children = object[this.childrenFieldName];
      var res = [];
      $.each(children, function(iRelation, relation) {
         var childOrder = relation[that.iChildOrderFieldName];
         var name = relation[that.childFieldName].strings[0].sTitle;
         res[iRelation] = name+'-'+childOrder;
      });
      console.error(res);
   },

   addObjectToTargetNode: function(object, targetRelation, hitMode, relation, action) {
      if(relation && relation[this.parentFieldName].ID === targetRelation[this.childFieldName].ID && hitMode == 'over') {
         // Do nothing, we just dragged an item over its parent
         return;
      }
      if(relation && relation[this.parentFieldName].ID === targetRelation[this.parentFieldName].ID && hitMode != "over") {
         // Reordering an item among its siblings
         var iChildOrderOld = relation[this.iChildOrderFieldName];
         var iChildOrderNew = targetRelation[this.iChildOrderFieldName];
         if(iChildOrderOld < iChildOrderNew) {
            if(hitMode == "before") { iChildOrderNew -= 1; }
            this.changeChildrenOrderBetween(targetRelation[this.parentFieldName], -1, iChildOrderOld, iChildOrderNew+1);
         } else {
            if(hitMode == "after") { iChildOrderNew += 1; }
            this.changeChildrenOrderBetween(targetRelation[this.parentFieldName], 1, iChildOrderNew);
         }
         relation[this.iChildOrderFieldName] = iChildOrderNew;
         this.cleanupOrders(targetRelation[this.parentFieldName]);
         ModelsManager.updated(this.relationsModelName, relation.ID);
         if (this.relationCreated !== undefined) {
            this.relationCreated(relation);
         }
      } else {
         // Actually copying/moving items
         var newRelation = ModelsManager.createRecord(this.relationsModelName);
         newRelation[this.idChildFieldName] = object.ID;
         if (hitMode === "over") {
            newRelation[this.idParentFieldName] = targetRelation[this.childFieldName].ID;
            newRelation[this.iChildOrderFieldName] = this.firstAvailableOrder(targetRelation[this.childFieldName]);
         } else {
            newRelation[this.idParentFieldName] = targetRelation[this.parentFieldName].ID;
            var iChildOrder = targetRelation[this.iChildOrderFieldName];
            if (hitMode == "after") {
               iChildOrder++;
            }
            this.changeChildrenOrderBetween(targetRelation[this.parentFieldName], 1, iChildOrder);
            newRelation[this.iChildOrderFieldName] = iChildOrder;
         }
         this.cleanupOrders(targetRelation[this.parentFieldName]);
         if (this.relationCreated != undefined) {
            this.relationCreated(newRelation);
         }
         ModelsManager.insertRecord(this.relationsModelName, newRelation);
         if(action == 'drop_move') {
            // We created a new relation to represent the old one we're moving,
            // delete the old one
            this.doDeleteRelation(relation);
         }
         alert(i18next.t('commonFramework:treeview_warning_access'));
      }
   },

   dropObject: function(targetNode, sourceNode, hitMode, action) {
      //logMsg("tree.onDrop(%o, %o, %s)", node, sourceNode, hitMode);
      var relation = ModelsManager.getRecord(this.relationsModelName, sourceNode.data.idRelation);
      var targetRelation = ModelsManager.getRecord(this.relationsModelName, targetNode.data.idRelation);
      this.addObjectToTargetNode(relation[this.childFieldName], targetRelation, hitMode, relation, action);
      return true;
   },

   isNodeAncestor: function(node1, node2) {
      if ((node1.data.idObject != undefined) || (node2.data.idObject != undefined)) {
         return false;
      }
      var idRelation1 = node1.data.idRelation;
      var idRelation2 = node2.data.idRelation;
      if ((idRelation1 == null) || (idRelation2 == null)) {
         return false;
      }
      var object1 = ModelsManager.getRecord(this.relationsModelName, idRelation1)[this.childFieldName];
      var object2 = ModelsManager.getRecord(this.relationsModelName, idRelation2)[this.childFieldName];
      if (object1.ID === object2.ID) {
         return true;
      }
      var children = node1.getChildren();
      if (children == null) {
         return false;
      }
      for (var iChild = 0; iChild < children.length; iChild++) {
         var childNode = children[iChild];
         if (this.isNodeAncestor(childNode, node2)) {
            return true;
         }
      }
      return false;
   },

   addSearchResults: function(objects) {
      var searchFolder = {
         title: i18next.t('commonFramework:treeview_search_results'),
         isFolder: true,
         key: "search",
         children: [],
         childOrder: 0
      };
      for (var objectID in objects) {
         var object = objects[objectID];
         var objectTitle = this.getObjectTitle(object);
         var treeNodes = this.getTree(object, objectTitle, "search_" + object.ID);
         treeNodes.idObject = object.ID;
         searchFolder.children.push(treeNodes);
      }
      var oldNode = this.getNodeByKey("search");
      if (oldNode != null) {
         oldNode.remove();
      }
      var rootNode = $("#" + this.name).dynatree("getRoot");
      rootNode.addChild(searchFolder);
      var searchNode = this.getNodeByKey("search");
      searchNode.expand();
   },

   getUnusedFolder: function() {
      var unusedFolder = {
         title: i18next.t('commonFramework:treeview_unused_objects'),
         isFolder: true,
         key: "unused",
         children: [],
         childOrder: 0
      };
      if (!this.displayUnused) {
         return unusedFolder;
      }
      var objects = ModelsManager.getRecords(this.objectsModelName);
      for (var objectID in objects) {
         var object = objects[objectID];
         if (!this.isObjectRoot(object) && (!objectHasProperties(object[this.parentsFieldName]))) {
            var objectTitle = this.getObjectTitle(object);
            var treeNodes = this.getTree(object, objectTitle, "unused_" + object.ID);
            treeNodes.idObject = object.ID;
            unusedFolder.children.push(treeNodes);
         }
      }
      return unusedFolder;
   },

   prepareDeletion: function() {
      ModelsManager.removeListener(this.relationsModelName, "inserted", this.name);
      ModelsManager.removeListener(this.relationsModelName, "updated", this.name);
      ModelsManager.removeListener(this.relationsModelName, "deleted", this.name);
      ModelsManager.removeListener(this.objectsModelName, "updated", this.name);
      ModelsManager.removeListener(this.objectsModelName, "inserted", this.name);
      if (this.objectsStringsModelName != null) {
         ModelsManager.removeListener(this.objectsStringsModelName, "inserted", this.name);
         ModelsManager.removeListener(this.objectsStringsModelName, "updated", this.name);
      }
      if (!this.staticData) {
         SyncQueue.removeSyncStartListeners(this.name);
      }
      SyncQueue.removeSyncEndListeners(this.name);
   },

   addListeners: function() {
      SyncQueue.addSyncStartListeners(this.name, this.triggers.syncStarted);
      SyncQueue.addSyncEndListeners(this.name, this.triggers.syncEnded);
      ModelsManager.addListener(this.relationsModelName, "inserted", this.name, this.triggers.relationInserted, true);
      ModelsManager.addListener(this.relationsModelName, "updated", this.name, this.triggers.relationUpdated, true);
      ModelsManager.addListener(this.relationsModelName, "deleted", this.name, this.triggers.relationDeleted, true);
      ModelsManager.addListener(this.objectsModelName, "updated", this.name, this.triggers.objectUpdated, true);
      ModelsManager.addListener(this.objectsModelName, "inserted", this.name, this.triggers.objectUpdated, true);
      if (this.objectsStringsModelName != null) {
         ModelsManager.addListener(this.objectsStringsModelName, "inserted", this.name, this.triggers.objectStringsUpdated, true);
         ModelsManager.addListener(this.objectsStringsModelName, "updated", this.name, this.triggers.objectStringsUpdated, true);
      }
   },

   fillTree: function() {
      if (!this.staticData) {
         this.addListeners();
      } else {
         var self = this;
         SyncQueue.addSyncEndListeners(this.name, function() {
            self.triggers.syncEnded();
            self.addListeners();
         });
      }
      var children = [];
      var unusedFolder = this.getUnusedFolder();
      if (this.displayUnused) {
         children.push(unusedFolder);
      }
      var that = this;
      $("#" + this.name).dynatree({
         clickFolderMode: that.clickFolderMode, // 1:activate, 2:expand, 3:activate and expand
         selectMode: that.selectMode,
         onQueryActivate: that.onQueryActivate,
         onQuerySelect: that.onQuerySelect,
         onActivate: function(node) {
            that.selectNode(node);
         },
         onExpand: function(flag, node) {
            that.expandNode(flag, node);
         },
         onKeydown: function(node, event) {
            if (event.which == 46) {
               node = $("#" + that.name).dynatree("getActiveNode");
               that.deleteObjectFromNode(node);
            }
         },
         dnd: that.readOnly ? undefined : {
            onDragStart: function(node) {
               return that.checkUserRight(node.data.idRelation, that.relationsModelName, 'delete');
            },
            onDrop: function(targetNode, sourceNode, hitMode, ui, draggable) {
               if (!that.checkUserRight(targetNode.data.idRelation, that.relationsModelName, 'insert')) {
                  return false;
               }
               if (sourceNode.data.idObject != undefined) {
                  var object = ModelsManager.getRecord(that.objectsModelName, sourceNode.data.idObject);
                  setTimeout(function() {
                     var targetRelation = ModelsManager.getRecord(that.relationsModelName, targetNode.data.idRelation);
                     that.addObjectToTargetNode(object, targetRelation, hitMode);
                  }, 100);
                  return;
               }
               var action = "context";
               if (hitMode == "over") {
                  if (targetNode.data.key === sourceNode.parent.data.key) {
                     action = "drop_move";
                  }
                  if (that.isNodeAncestor(sourceNode, targetNode)) {
                     action = "cancel";
                  }
               } else {
                  if ((targetNode.parent !== null) &&
                     (targetNode.parent.data.key === sourceNode.parent.data.key)) {
                     action = "drop_move";
                  }
                  if (that.isNodeAncestor(sourceNode, targetNode.parent)) {
                     action = "cancel";
                  }
               }
               if (action == "cancel") {} else if (action !== "context") {
                  setTimeout(function() {
                     that.dropObject(targetNode, sourceNode, hitMode, action);
                  }, 100);
               } else {
                  that.commonData.isDropping = true;
                  that.commonData.targetNode = targetNode;
                  that.commonData.sourceNode = sourceNode;
                  that.commonData.hitMode = hitMode;
                  $(targetNode.span).contextMenu();
                  that.commonData.isDropping = false;
               }
            },
            onDragStop: function(node) {
               // This function is optional.
            },
            autoExpandMS: 1000,
            preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.
            onDragEnter: function(node, sourceNode) {
               /** sourceNode may be null for non-dynatree droppables.
                *  Return false to disallow dropping on node. In this case
                *  onDragOver and onDragLeave are not called.
                *  Return 'over', 'before, or 'after' to force a hitMode.
                *  Return ['before', 'after'] to restrict available hitModes.
                *  Any other return value will calc the hitMode from the cursor position.
                */
               if (!that.checkUserRight(node.data.idRelation, that.relationsModelName, 'insert')) {
                  return false;
               }
               var modes = [];
               if ((node.data.key == "unused") || (node.parent.data.key == "unused") || (sourceNode.data.key == "unused")) {
                  return modes;
               }
               if ((node.data.key == "search") || (node.parent.data.key == "search") || (sourceNode.data.key == "search")) {
                  return modes;
               }
               if (!that.isNodeAncestor(sourceNode, node)) {
                  modes.push('over');
               }
               if (!that.isNodeAncestor(sourceNode, node.parent)) {
                  modes.push('before');
                  modes.push('after');
               }
               return modes;
            },
            onDragOver: function(node, sourceNode, hitMode) {
               return true;
            },
            onDragLeave: function(node, sourceNode) {
               /** Always called if onDragEnter was called.
                */
               //logMsg("tree.onDragLeave(%o, %o)", node, sourceNode);
            }
         },
         children: children
      });
      var tree = $("#" + that.name).dynatree("getTree");
      if (this.staticData) {
         this.fillWithStaticData();
         tree.enableUpdate(false);
      } else {
         tree.reload();
      }
      if (that.readOnly) {
         return;
      }
      $.contextMenu({
         selector: "#" + this.name + " .dynatree-node",
         build: function($trigger) {
            var node = $.ui.dynatree.getNode($trigger[0]);
            var items;
            if ((node.data.key == "unused") || (node.data.key == "search")) {
               return false;
            }
            if (that.commonData.isDropping) {
               items = {
                  "drop_copy": {
                     name: i18next.t('commonFramework:copy'),
                     icon: "copy"
                  },
                  "drop_move": {
                     name: i18next.t('commonFramework:move'),
                     icon: "paste"
                  },
               };
            } else {
               if (node.data.idObject) {
                  items = {
                     "copy": {
                        name: i18next.t('commonFramework:copy'),
                        icon: "copy"
                     }
                  };
               } else {
                  items = {
                     "cut": {
                        name: i18next.t('commonFramework:cut'),
                        icon: "cut"
                     },
                     "copy": {
                        name: i18next.t('commonFramework:copy'),
                        icon: "copy"
                     },
                     "paste": {
                        name: i18next.t('commonFramework:paste'),
                        icon: "paste"
                     },
                     "delete": {
                        name: i18next.t('commonFramework:remove'),
                        icon: "delete"
                     },
                     "create": {
                        name: i18next.t('commonFramework:new'),
                        icon: "edit"
                     }
                  };
               }
            }
            return {
               callback: function(key, options) {
                  var node = $.ui.dynatree.getNode($trigger[0]);

                  switch (key) {
                     case "delete":
                        that.deleteObjectFromNode(node);
                        break;
                     case "drop_copy":
                     case "drop_move":
                        that.dropObject(that.commonData.targetNode, that.commonData.sourceNode, that.commonData.hitMode, key);
                        break;
                     case "copy":
                        that.copyRelation(node, false);
                        break;
                     case "cut":
                        that.copyRelation(node, true);
                        break;
                     case "paste":
                        that.pasteRelation(node);
                        break;
                     case "create":
                        that.createChild(node.data.idRelation);
                        break;
                  }
               },
               items: items
            };
         }
      });
   }
});
