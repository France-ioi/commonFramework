<?php

function getFieldName($viewModel, $fieldAlias) {
   $field = $viewModel["fields"][$fieldAlias];
   if (isset($field["fieldName"])) { // In case we use aliases that are not equal to the field name
      return $field["fieldName"];
   }
   return $fieldAlias;
}

function getFieldTable($viewModel, $fieldAlias) {
   $tableName = $viewModel["mainTable"];
   if (!isset ($viewModel["fields"][$fieldAlias])) { return false; }
   $field = $viewModel["fields"][$fieldAlias];
   if (isset($field["tableName"])) {
      $tableName = $field["tableName"];
   }
   return $tableName;
}

function getPrimaryKey($viewModel) {
   if (!$viewModel || !is_array($viewModel)) {
      error_log('no ViewModel provided');
      return;
   }
   if (isset($viewModel["primaryKey"])) {
      return $viewModel["primaryKey"];
   }
   $tableModel = getTableModel($viewModel["mainTable"]);
   if (isset($tableModel["primaryKey"])) {
      return $tableModel["primaryKey"];
   }
   return "ID";
}

function getFieldType($viewModel, $fieldAlias) {
   $tableName = getFieldTable($viewModel, $fieldAlias);
   if (!$tableName) { return false; }
   $field = $viewModel["fields"][$fieldAlias];
   if (isset($field["type"])) {
      return $field["type"];
   }
   $tableModel = getTableModel($tableName);
   $fieldName = getFieldName($viewModel, $fieldAlias);
   if (!isset($tableModel["fields"][$fieldName])) {
      return false;
   }
   return $tableModel["fields"][$fieldName]["type"];
}

function sqlGreatest($expressions) {
   if (!count($expressions)) {
      return '';
   } elseif (count($expressions) == 1) {
      return $expressions[0];
   }
   return "GREATEST(".implode($expressions, ", ").")";
}

function getRandomID() {
   $bytes = openssl_random_pseudo_bytes(4);
   $i = abs(unpack('N', $bytes)[1]);
   $rand = (string) ($i % 999899999 + 100000);
   $bytes = openssl_random_pseudo_bytes(4);
   $i = abs(unpack('N', $bytes)[1]);
   $rand .= (string) ($i % 998999999 + 1000000);
   return $rand;
}
