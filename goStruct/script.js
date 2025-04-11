function convert() {
  const inputText = document.getElementById('inputText').value;
  const jsonTag = document.getElementById('jsonTag').checked;
  const xmlTag = document.getElementById('xmlTag').checked;
  const gormTag = document.getElementById('gormTag').checked;
  let output = '';

  // Simple logic to determine if input is JSON or SQL (this is a placeholder)
  if (inputText.trim().startsWith('{') || inputText.trim().startsWith('[')) {
    output = convertJsonToGoStruct(inputText, jsonTag, xmlTag, gormTag);
  } else {
    output = convertSqlToGoStruct(inputText, jsonTag, xmlTag, gormTag);
  }

  document.getElementById('outputText').value = output;
}

function convertJsonToGoStruct(json, jsonTag, xmlTag, gormTag) {
  try {
    const jsonObject = JSON.parse(json);
    let struct = 'type GoStruct struct {\n';

    for (const key in jsonObject) {
      if (jsonObject.hasOwnProperty(key)) {
        const type = typeof jsonObject[key];
        let goType = 'interface{}';

        switch (type) {
          case 'string':
            goType = 'string';
            break;
          case 'number':
            goType = Number.isInteger(jsonObject[key]) ? 'int64' : 'float64';
            break;
          case 'boolean':
            goType = 'bool';
            break;
          case 'object':
            goType = Array.isArray(jsonObject[key]) ? '[]interface{}' : 'struct{}';
            break;
        }

        let tags = '';
        if (jsonTag) tags += ` json:\"${key}\"`;
        if (xmlTag) tags += ` xml:\"${key}\"`;
        if (gormTag) tags += ` gorm:\"column:${key}\"`;

        struct += `  ${capitalizeFirstLetter(key)} ${goType} \`${tags.trim()}\`\n`;
      }
    }

    struct += '}\n';
    return struct;
  } catch (error) {
    return '// Invalid JSON input\n';
  }
}

function convertSqlToGoStruct(sql, jsonTag, xmlTag, gormTag) {
  const lines = sql.split('\n');
  let struct = 'type GoStruct struct {\n';

  lines.forEach(line => {
    // 从sql ddl语句里面读取tale名
    const tableNameMatch = line.match(/CREATE TABLE `(\w+)`/);
    if (tableNameMatch) {
      const tableName = tableNameMatch[1];
      struct = `type ${capitalizeFirstLetter(tableName)} struct {\n`;
    }
    // 从sql ddl语句里面读取字段名和类型
    const match = line.match(/`(\w+)`\s+(\w+)/);
    if (match) {
      const [, columnName, sqlType] = match;
      let goType = 'interface{}';

      switch (sqlType.toLowerCase()) {
        case 'varchar':
        case 'text':
          goType = 'string';
          break;
        case 'int':
        case 'integer':
          goType = 'int64';
          break;
        case 'bigint':
          goType = 'int64';
          break;
        case 'float':
        case 'double':
          goType = 'float64';
          break;
        case 'boolean':
          goType = 'bool';
          break;
        case 'datetime':
        case 'timestamp':
          goType = 'time.Time';
          break;
        // Add more SQL to Go type mappings as needed
      }

      let tags = '';
      if (jsonTag) tags += ` json:\"${columnName}\"`;
      if (xmlTag) tags += ` xml:\"${columnName}\"`;
      if (gormTag) tags += ` gorm:\"column:${columnName}\"`;

      struct += `  ${capitalizeFirstLetter(columnName)} ${goType} \`${tags.trim()}\`\n`;
    }
  });

  struct += '}\n';
  return struct;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}