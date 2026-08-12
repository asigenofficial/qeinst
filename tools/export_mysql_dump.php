<?php

declare(strict_types=1);

$dbPath = $argv[1] ?? __DIR__ . '/../backend/database/database.sqlite';
$outPath = $argv[2] ?? __DIR__ . '/../backend/database/qeinst_db.sql';
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$quoteIdent = static fn(string $value): string => '`' . str_replace('`', '``', $value) . '`';
$quoteValue = static function ($value): string {
    if ($value === null) return 'NULL';
    if (is_int($value) || is_float($value)) return (string) $value;
    $value = str_replace(["\\", "\0", "\n", "\r", "'"], ["\\\\", "\\0", "\\n", "\\r", "\\'"], (string) $value);
    return "'{$value}'";
};

$tables = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
$tables = array_values(array_filter($tables, static fn(string $table): bool => $table !== 'migrations'));

$sql = [];
$sql[] = '-- Generated from the current Laravel SQLite schema and seed data.';
$sql[] = '-- Source of truth: backend/database/migrations and backend/database/seeders.';
$sql[] = 'SET FOREIGN_KEY_CHECKS=0;';
$sql[] = '';

foreach ($tables as $table) {
    $columns = $pdo->query('PRAGMA table_info(' . $quoteIdent($table) . ')')->fetchAll(PDO::FETCH_ASSOC);
    $foreignKeys = $pdo->query('PRAGMA foreign_key_list(' . $quoteIdent($table) . ')')->fetchAll(PDO::FETCH_ASSOC);
    $indexes = $pdo->query('PRAGMA index_list(' . $quoteIdent($table) . ')')->fetchAll(PDO::FETCH_ASSOC);
    $definitions = [];
    $primaryKeyColumns = [];

    foreach ($columns as $column) {
        $name = (string) $column['name'];
        $type = strtoupper((string) $column['type']);
        $isPrimary = (int) $column['pk'] === 1;
        $default = $column['dflt_value'];
        $notNull = (int) $column['notnull'] === 1 || $isPrimary;

        if ($isPrimary && $name === 'id') {
            $mysqlType = 'BIGINT(20) UNSIGNED';
        } elseif ($type === 'INTEGER' && (str_ends_with($name, '_id') || $name === 'id')) {
            $mysqlType = 'BIGINT(20) UNSIGNED';
        } elseif ($type === 'INTEGER' && (str_starts_with($name, 'is_') || str_starts_with($name, 'has_') || $name === 'remember_token')) {
            $mysqlType = 'TINYINT(1)';
        } elseif ($type === 'INTEGER') {
            $mysqlType = 'INT';
        } elseif ($type === 'TEXT') {
            $mysqlType = str_contains($name, 'description') || str_contains($name, 'message') || str_contains($name, 'notes') ? 'LONGTEXT' : 'TEXT';
        } elseif (str_contains($type, 'CHAR') || str_contains($type, 'VARCHAR')) {
            $mysqlType = 'VARCHAR(255)';
        } elseif ($type === 'DATE') {
            $mysqlType = 'DATE';
        } elseif (str_contains($type, 'DATETIME') || str_contains($type, 'TIMESTAMP')) {
            $mysqlType = 'TIMESTAMP';
        } else {
            $mysqlType = 'VARCHAR(255)';
        }

        $definition = $quoteIdent($name) . ' ' . $mysqlType;
        if ($isPrimary && $name === 'id') $definition .= ' NOT NULL AUTO_INCREMENT';
        elseif ($notNull) $definition .= ' NOT NULL';
        else $definition .= ' NULL';

        if (!$isPrimary && $default !== null) {
            $default = trim((string) $default);
            if (preg_match('/^CURRENT_TIMESTAMP$/i', $default)) $definition .= ' DEFAULT CURRENT_TIMESTAMP';
            elseif (preg_match('/^\'[^\']*\'$/', $default)) $definition .= ' DEFAULT ' . $default;
            elseif (is_numeric($default)) $definition .= ' DEFAULT ' . $default;
        }
        $definitions[] = $definition;
        if ($isPrimary) $primaryKeyColumns[] = $name;
    }

    if ($primaryKeyColumns) $definitions[] = 'PRIMARY KEY (' . implode(', ', array_map($quoteIdent, $primaryKeyColumns)) . ')';

    foreach ($indexes as $index) {
        if ((int) $index['origin'] !== 0) continue;
        $indexName = (string) $index['name'];
        $indexColumns = $pdo->query('PRAGMA index_info(' . $quoteIdent($indexName) . ')')->fetchAll(PDO::FETCH_ASSOC);
        $indexColumnNames = array_values(array_filter(array_map(static fn(array $row): ?string => $row['name'] ?? null, $indexColumns)));
        if (!$indexColumnNames) continue;
        $kind = (int) $index['unique'] === 1 ? 'UNIQUE KEY ' : 'KEY ';
        $definitions[] = $kind . $quoteIdent($indexName) . ' (' . implode(', ', array_map($quoteIdent, $indexColumnNames)) . ')';
    }

    foreach ($foreignKeys as $foreignKey) {
        $definitions[] = 'CONSTRAINT ' . $quoteIdent('fk_' . $table . '_' . $foreignKey['id']) . ' FOREIGN KEY (' . $quoteIdent((string) $foreignKey['from']) . ') REFERENCES ' . $quoteIdent((string) $foreignKey['table']) . ' (' . $quoteIdent((string) $foreignKey['to']) . ')' . ((string) $foreignKey['on_delete'] !== 'NO ACTION' ? ' ON DELETE ' . (string) $foreignKey['on_delete'] : '');
    }

    $sql[] = 'DROP TABLE IF EXISTS ' . $quoteIdent($table) . ';';
    $sql[] = 'CREATE TABLE ' . $quoteIdent($table) . " (\n  " . implode(",\n  ", $definitions) . "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $rows = $pdo->query('SELECT * FROM ' . $quoteIdent($table))->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        if (!$row) continue;
        $names = array_keys($row);
        $values = array_map($quoteValue, array_values($row));
        $sql[] = 'INSERT INTO ' . $quoteIdent($table) . ' (' . implode(', ', array_map($quoteIdent, $names)) . ') VALUES (' . implode(', ', $values) . ');';
    }
    $sql[] = '';
}

$sql[] = 'SET FOREIGN_KEY_CHECKS=1;';
file_put_contents($outPath, implode("\n", $sql) . "\n");
echo "Exported " . count($tables) . " tables to {$outPath}\n";
