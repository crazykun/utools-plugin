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
  return output;
}

// 在 getStructName 函数中添加唯一后缀
function getStructName(key, level) {
  const tail = level > 2 ? `${level - 2}` : '';
  return `${capitalizeFirstLetter(key)}${tail}`;
}

function getTypeAndProcess(value, key, level) { // 新增参数 key 和 level
  let goType = 'interface{}';
  let needsRecursive = false;

  const type = typeof value;
  switch (type) {
    case 'string':
      goType = 'string';
      break;
    case 'number':
      goType = Number.isInteger(value) ? 'int64' : 'float64';
      break;
    case 'boolean':
      goType = 'bool';
      break;
    case 'object':
      if (value === null) {
        goType = 'interface{}';
      } else if (Array.isArray(value)) {
        goType = '[]interface{}';
      } else {
        // 根据字段名和层级生成结构体名称
        const structName = getStructName(key, level + 1); // 下一层级
        goType = structName;
        needsRecursive = true;
      }
      break;
  }

  return { goType, needsRecursive };
}

function convertJsonToGoStruct(
  json,
  jsonTag,
  xmlTag,
  gormTag,
  level = 1,
  path = ''
) {
  try {
    const jsonObject = JSON.parse(json);
    const structDefinitions = [];
    let mainStructName = level === 1 ? 'GoStruct' : getStructName(path, level);
    let mainStruct = `type ${mainStructName} struct {\n`;

    for (const key in jsonObject) {
      if (jsonObject.hasOwnProperty(key)) {
        const value = jsonObject[key];
        const childKey = key
          .split('_')
          .map(word => capitalizeFirstLetter(word))
          .join('');
        const currentPath = path ? `${path}${childKey}` : childKey; // 构建当前路径
        // 传递路径参数
        let { goType, needsRecursive } = getTypeAndProcess(
          value,
          childKey,
          level,
          currentPath
        );

        if (needsRecursive) {
          const nestedStructName = getStructName(currentPath, level + 1);
          const nestedJson = JSON.stringify(value);
          const nestedStruct = convertJsonToGoStruct(
            nestedJson,
            jsonTag,
            xmlTag,
            gormTag,
            level + 1,
            currentPath // 传递完整路径
          );
          structDefinitions.push(nestedStruct);
          goType = nestedStructName; // 使用生成的结构体名称
        }

        // 生成字段标签
        let tags = '';
        if (jsonTag) tags += ` json:"${key}"`;
        if (xmlTag) tags += ` xml:"${key}"`;
        if (gormTag) tags += ` gorm:"column:${key}"`;

        mainStruct += `  ${capitalizeFirstLetter(childKey)} ${goType} \`${tags.trim()}\`\n`;
      }
    }

    mainStruct += '}\n';
    structDefinitions.push(mainStruct);
    return structDefinitions.join('\n');
  } catch (error) {
    console.error('Invalid JSON input:', error);
    return '// Invalid JSON input\n';
  }
}


function convertSqlToGoStruct(sql, jsonTag, xmlTag, gormTag) {
  const lines = sql.split('\n');
  let struct = 'type GoStruct struct {\n';
  let tableName = '';
  let capitalizeTableName = '';

  lines.forEach(line => {
    // 从sql ddl语句里面读取tale名
    const tableNameMatch = line.match(/CREATE TABLE `(\w+)`/);
    if (tableNameMatch) {
      tableName = tableNameMatch[1];
      // 将表名转换为大写字母开头的驼峰命名法
      capitalizeTableName = tableName
        .split('_')
        .map(word => capitalizeFirstLetter(word))
        .join('');
      struct = `type ${capitalizeFirstLetter(capitalizeTableName)} struct {\n`;
    }
    // 从sql ddl语句里面读取字段名和类型
    const match = line.match(/`(\w+)`\s+(\w+)/);
    // 提取备注COMMENT
    const commentMatch = line.match(/COMMENT\s+'(.*)'/);
    // 检查是否有当前时间默认值
    const hasCurrentTimeDefault = /DEFAULT\s+(CURRENT_TIMESTAMP|NOW\(\)|CURRENT_TIME)/i.test(line);
    // 检查是否有ON UPDATE CURRENT_TIMESTAMP
    const hasOnUpdateCurrentTime = /ON\s+UPDATE\s+(CURRENT_TIMESTAMP|NOW\(\)|CURRENT_TIME)/i.test(line);

    if (match) {
      const [, name, sqlType] = match;
      let goType = 'interface{}';
      let isTimeField = false;

      switch (sqlType.toLowerCase()) {
        case 'varchar':
        case 'text':
          goType = 'string';
          break;
        case 'int':
        case 'bigint':
        case 'smallint':
        case 'tinyint':
        case 'mediumint':
          goType = 'int64';
          break;
        case 'float':
        case 'double':
        case 'decimal':
          goType = 'float64';
          break;
        case 'boolean':
          goType = 'bool';
          break;
        case 'datetime':
        case 'timestamp':
          goType = 'time.Time';
          isTimeField = true;
          break;
        // Add more SQL to Go type mappings as needed
      }

      let tags = '';
      if (jsonTag) tags += ` json:\"${name}\"`;
      if (xmlTag) tags += ` xml:\"${name}\"`;
      if (gormTag) {
        let gormTags = `column:${name}`;
        // 如果是时间字段且有当前时间默认值，添加autoCreateTime标签
        if (isTimeField && hasCurrentTimeDefault) {
          gormTags += ';autoCreateTime';
        }
        // 如果是时间字段且有ON UPDATE CURRENT_TIMESTAMP，添加autoUpdateTime标签
        if (isTimeField && hasOnUpdateCurrentTime) {
          gormTags += ';autoUpdateTime';
        }
        tags += ` gorm:\"${gormTags}\"`;
      }
      tags += ` comment:\"${commentMatch ? commentMatch[1] : ''}\"`;

      colunmName = name.split('_').map(word => capitalizeFirstLetter(word)).join('');
      struct += `  ${colunmName} ${goType} \`${tags.trim()}\`\n`;
    }
  });

  struct += '}\n';

  // 添加表名 // TableName 表名称
  struct += `\n\nfunc (*${capitalizeTableName}) TableName() string {
    return "${tableName}"
  }`;

  return struct;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function copyToClipboard() {
  const outputText = document.getElementById('outputText');
  const text = outputText.value;
  if (typeof utools !== 'undefined' && utools.copyText) {
    utools.copyText(text);
    showToast("Copy: Success");
  } else {
    console.error('uTools API is not available.');
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.className = 'toast show';
  toast.innerText = message;
  setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
}

utools.onPluginEnter(({ code, type, payload }) => {
  if (code) {
    document.getElementById('inputText').value = payload;
    convert();
  }
});

// 添加自动转换功能
let convertTimeout;
const inputTextArea = document.getElementById('inputText');

inputTextArea.addEventListener('input', function () {
  // 清除之前的定时器
  if (convertTimeout) {
    clearTimeout(convertTimeout);
  }

  // 设置新的定时器，延迟500ms执行自动转换
  convertTimeout = setTimeout(function () {
    const inputText = inputTextArea.value.trim();
    if (inputText) {
      const result = convert();
      // 如果转换成功且有输出，则自动复制
      if (result && !result.startsWith('// Invalid JSON input')) {
        copyToClipboard();
      }
    }
  }, 500);
});
