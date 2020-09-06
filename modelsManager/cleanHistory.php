<?php

/* Copyright (c) 2013-2020 Apycat / Association France-ioi, MIT License http://opensource.org/licenses/MIT */

die("No access.");

require_once __DIR__."/../../shared/connect.php";
require_once __DIR__."/../../shared/models.php";


function cleanHistory($tableName, $tableModel) {
   global $db;

   echo " * Table $tableName\n";
   $historyTableName = 'history_' . $tableName;

   echo "Locking tables : ";
   $db->exec("LOCK TABLES `$tableName` WRITE, `$historyTableName` WRITE;");
   echo " done.\n";

   echo "Cleaning history table for $tableName... ";
   $db->exec("TRUNCATE `$historyTableName`;");
   echo " done.\n";

   echo "Regenerating minimal history :\n";
   $fields = array_keys($tableModel['fields']);
   array_unshift($fields, 'ID');
   $fields[] = 'iVersion';
   $fieldsStr = "`".implode('`, `', $fields)."`";
   $fieldsStrWithPrefix = "`".$tableName."`.`".implode("`, `".$tableName."`.`", $fields)."`";

   $query = "INSERT INTO `$historyTableName` (".$fieldsStr.", `bDeleted`, `iNextVersion`) ".
      "(SELECT ".$fieldsStrWithPrefix.", 0 as `bDeleted`, NULL as `iNextVersion` ".
       "FROM `$tableName`)";

   echo $query . "\n";
   $db->exec($query);
   echo "done.\n";

   $db->exec("UNLOCK TABLES;");
}

$tableNames = [];
foreach ($tablesModels as $tableName => $tableModel) {
   $tableNames[] = $tableName;
   if($argc > 1 && ($argv[1] == '--all' || in_array($tableName, $argv))) {
      cleanHistory($tableName, $tableModel);
   }
}
if($argc < 2) {
   echo "Specify table names or '--all' for all tables.\n";
   echo "Tables with history : " . implode(' ', $tableNames) . "\n";
}
