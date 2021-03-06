# commonFramework

Libraries used in many France-ioi projects:

* [AlgoreaPlatform](https://github.com/France-ioi/AlgoreaPlatform)
* [TaskPlatform](https://github.com/France-ioi/TaskPlatform)
* [bebras-platform](https://github.com/France-ioi/bebras-platform)
* maybe others...?

## Requirements

* jQuery
* i18next
* angular and ng-i18next (for angularDirectives/formField)
* dynatree (for treeview)
* ...?

## Contents

* `modelsManager`: provides, server-side and client-side, models of the data in the database, for easy manipulation and update
* `syncServer`: synchronises (incementally) data between the server and the clients, using the models from `modelsManager`
* `treeview`: uses dynatree to show an editable tree of items and their relationships, allowing selection, clonage and movement of the items
* `i18n`: translation files for commonFramework, and some simple tools to help translation
