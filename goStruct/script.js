function convert() {
  const inputText = getElement('inputText').value.trim();

  if (!inputText) {
    getElement('outputText').value = '';
    return '';
  }

  const jsonTag = getElement('jsonTag').checked;
  const xmlTag = getElement('xmlTag').checked;
  const gormTag = getElement('gormTag').checked;

  let output = '';

  try {
    // 更精确的判断逻辑
    if (inputText.startsWith('{') || inputText.startsWith('[')) {
      output = convertJsonToGoStruct(inputText, jsonTag, xmlTag, gormTag);
    } else if (inputText.toLowerCase().includes('create table')) {
      output = convertSqlToGoStruct(inputText, jsonTag, xmlTag, gormTag);
    } else {
      // 尝试解析为JSON
      try {
        JSON.parse(inputText);
        output = convertJsonToGoStruct(inputText, jsonTag, xmlTag, gormTag);
      } catch {
        output = convertSqlToGoStruct(inputText, jsonTag, xmlTag, gormTag);
      }
    }
  } catch (error) {
    console.error('转换错误:', error);
    output = CONSTANTS.ERROR_MESSAGES.CONVERSION_FAILED;
  }

  getElement('outputText').value = output;
  return output;
}

// 在 getStructName 函数中添加唯一后缀
function getStructName(key, level) {
  const tail = level > 2 ? `${level - 2}` : '';
  return `${capitalizeFirstLetter(key)}${tail}`;
}

function getTypeAndProcess(value, key, level) {
  let goType = 'interface{}';
  let needsRecursive = false;

  if (value === null) {
    return { goType: 'interface{}', needsRecursive: false };
  }

  if (Array.isArray(value)) {
    if (value.length > 0) {
      const firstElement = value[0];
      if (typeof firstElement === 'object' && firstElement !== null && !Array.isArray(firstElement)) {
        const structName = getStructName(key, level + 1);
        goType = `[]${structName}`;
        needsRecursive = true;
      } else {
        const elementType = typeof firstElement;
        switch (elementType) {
          case 'string':
            goType = '[]string';
            break;
          case 'number':
            goType = Number.isInteger(firstElement) ? '[]int64' : '[]float64';
            break;
          case 'boolean':
            goType = '[]bool';
            break;
          default:
            goType = '[]interface{}';
        }
      }
    } else {
      goType = '[]interface{}';
    }
    return { goType, needsRecursive };
  }

  switch (typeof value) {
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
      const structName = getStructName(key, level + 1);
      goType = structName;
      needsRecursive = true;
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
    const mainStructName = level === 1 ? 'GoStruct' : getStructName(path, level);
    let mainStruct = `type ${mainStructName} struct {\n`;

    for (const [key, value] of Object.entries(jsonObject)) {
      const childKey = key
        .split('_')
        .map(word => capitalizeFirstLetter(word))
        .join('');
      const currentPath = path ? `${path}${childKey}` : childKey;

      let { goType, needsRecursive } = getTypeAndProcess(
        value,
        childKey,
        level
      );

      if (needsRecursive) {
        const nestedStructName = getStructName(currentPath, level + 1);
        let nestedValue = value;

        // 处理数组类型
        if (Array.isArray(value) && value.length > 0) {
          nestedValue = value[0];
          goType = `[]${nestedStructName}`;
        } else {
          goType = nestedStructName;
        }

        const nestedJson = JSON.stringify(nestedValue);
        const nestedStruct = convertJsonToGoStruct(
          nestedJson,
          jsonTag,
          xmlTag,
          gormTag,
          level + 1,
          currentPath
        );
        structDefinitions.push(nestedStruct);
      }

      // 生成字段标签
      const tags = [];
      if (jsonTag) tags.push(`json:"${key}"`);
      if (xmlTag) tags.push(`xml:"${key}"`);
      if (gormTag) tags.push(`gorm:"column:${key}"`);

      const tagString = tags.length > 0 ? ` \`${tags.join(' ')}\`` : '';
      mainStruct += `  ${capitalizeFirstLetter(childKey)} ${goType}${tagString}\n`;
    }

    mainStruct += '}\n';
    structDefinitions.push(mainStruct);
    return structDefinitions.join('\n');
  } catch (error) {
    console.error('Invalid JSON input:', error);
    return CONSTANTS.ERROR_MESSAGES.INVALID_JSON;
  }
}

function convertSqlToGoStruct(sql, jsonTag, xmlTag, gormTag) {
  const lines = sql.split('\n');
  let struct = 'type GoStruct struct {\n';
  let tableName = '';
  let capitalizeTableName = '';

  // SQL类型到Go类型的映射
  const sqlToGoTypeMap = {
    'varchar': 'string',
    'text': 'string',
    'char': 'string',
    'longtext': 'string',
    'mediumtext': 'string',
    'tinytext': 'string',
    'int': 'int64',
    'bigint': 'int64',
    'smallint': 'int64',
    'tinyint': 'int64',
    'mediumint': 'int64',
    'float': 'float64',
    'double': 'float64',
    'decimal': 'float64',
    'numeric': 'float64',
    'boolean': 'bool',
    'bool': 'bool',
    'datetime': 'time.Time',
    'timestamp': 'time.Time',
    'date': 'time.Time',
    'time': 'time.Time'
  };

  // 需要跳过的SQL关键字和语句
  const skipKeywords = [
    'PRIMARY', 'KEY', 'INDEX', 'UNIQUE', 'FOREIGN', 'CONSTRAINT',
    'ENGINE', 'CHARSET', 'COLLATE', 'AUTO_INCREMENT', 'DEFAULT',
    'USING', 'BTREE', 'HASH', 'InnoDB', 'MyISAM', 'MEMORY',
    'REFERENCES', 'ON', 'DELETE', 'UPDATE', 'CASCADE', 'RESTRICT',
    'SET', 'NULL', 'CURRENT_TIMESTAMP', 'NOW()', 'FULLTEXT'
  ];

  lines.forEach(line => {
    const trimmedLine = line.trim();

    // 跳过空行、注释行、以及特殊SQL语句
    if (!trimmedLine ||
      trimmedLine.startsWith('--') ||
      trimmedLine.startsWith('/*') ||
      trimmedLine.startsWith('*/') ||
      trimmedLine.startsWith(')') ||
      trimmedLine === '{' ||
      trimmedLine === '}') {
      return;
    }

    // 从sql ddl语句里面读取table名
    const tableNameMatch = trimmedLine.match(/CREATE TABLE `?(\w+)`?/i);
    if (tableNameMatch) {
      tableName = tableNameMatch[1];
      // 将表名转换为大写字母开头的驼峰命名法
      capitalizeTableName = tableName
        .split('_')
        .map(word => capitalizeFirstLetter(word))
        .join('');
      struct = `type ${capitalizeTableName} struct {\n`;
      return;
    }

    // 跳过包含SQL关键字的行（但不是字段定义中的关键字）
    const upperLine = trimmedLine.toUpperCase();
    const startsWithKeyword = skipKeywords.some(keyword =>
      upperLine.startsWith(keyword) ||
      upperLine.startsWith(`  ${keyword}`) ||
      upperLine.includes(`${keyword} KEY`) ||
      upperLine.includes(`${keyword}(`)
    );

    if (startsWithKeyword) {
      return;
    }

    // 更精确的字段匹配：必须以反引号或字母开头，后跟数据类型
    const fieldMatch = trimmedLine.match(/^\s*`?([a-zA-Z_]\w*)`?\s+(varchar|text|char|longtext|mediumtext|tinytext|int|bigint|smallint|tinyint|mediumint|float|double|decimal|numeric|boolean|bool|datetime|timestamp|date|time)(\([^)]*\))?\s*/i);

    if (fieldMatch) {
      const [, name, sqlType] = fieldMatch;

      // 再次检查是否为关键字
      if (skipKeywords.includes(name.toUpperCase())) {
        return;
      }

      const baseType = sqlType.toLowerCase();
      const goType = sqlToGoTypeMap[baseType] || 'interface{}';
      const isTimeField = goType === 'time.Time';

      // 提取备注COMMENT
      const commentMatch = trimmedLine.match(/COMMENT\s+['"]([^'"]*)['"]/i);
      // 检查是否有当前时间默认值
      const hasCurrentTimeDefault = /DEFAULT\s+(CURRENT_TIMESTAMP|NOW\(\)|CURRENT_TIME)/i.test(trimmedLine);
      // 检查是否有ON UPDATE CURRENT_TIMESTAMP
      const hasOnUpdateCurrentTime = /ON\s+UPDATE\s+(CURRENT_TIMESTAMP|NOW\(\)|CURRENT_TIME)/i.test(trimmedLine);

      const tags = [];
      if (jsonTag) tags.push(`json:"${name}"`);
      if (xmlTag) tags.push(`xml:"${name}"`);

      if (gormTag) {
        let gormTags = [`column:${name}`];
       
        // 如果是时间字段且有ON UPDATE CURRENT_TIMESTAMP，添加autoUpdateTime标签
        if (isTimeField && hasOnUpdateCurrentTime) {
          gormTags.push('autoUpdateTime');
        } else if (isTimeField && hasCurrentTimeDefault) {
          // 如果是时间字段且有当前时间默认值，添加autoCreateTime标签
          gormTags.push('autoCreateTime');
        }
        tags.push(`gorm:"${gormTags.join(';')}"`);
      }

      if (commentMatch && commentMatch[1]) {
        tags.push(`comment:"${commentMatch[1]}"`);
      }

      const columnName = name.split('_').map(word => capitalizeFirstLetter(word)).join('');
      const tagString = tags.length > 0 ? ` \`${tags.join(' ')}\`` : '';
      struct += `  ${columnName} ${goType}${tagString}\n`;
    }
  });

  struct += '}\n';

  // 添加表名方法
  if (tableName && capitalizeTableName) {
    struct += `\n// TableName 表名称\nfunc (*${capitalizeTableName}) TableName() string {\n    return "${tableName}"\n}`;
  }

  return struct;
}

// 常量定义
const CONSTANTS = {
  DEBOUNCE_DELAY: 500,
  TOAST_DURATION: 2300,
  ERROR_MESSAGES: {
    INVALID_JSON: '// Invalid JSON input\n',
    CONVERSION_FAILED: '// 转换失败，请检查输入格式\n'
  },
  SUCCESS_MESSAGES: {
    COPY_SUCCESS: '✓ 复制成功',
    PASTE_SUCCESS: '✓ 粘贴成功',
    CLEAR_SUCCESS: '✓ 已清空'
  },
  ERROR_TOAST_MESSAGES: {
    COPY_FAILED: '✗ 复制失败',
    PASTE_FAILED: '✗ 粘贴失败',
    CONVERSION_FAILED: '⚠ 转换失败，请检查输入格式'
  }
};

function capitalizeFirstLetter(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// 缓存DOM元素以提高性能
const domCache = {};
function getElement(id) {
  if (!domCache[id]) {
    domCache[id] = document.getElementById(id);
  }
  return domCache[id];
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}



function copyToClipboard() {
  const outputText = getElement('outputText');
  const text = outputText.value;
  if (typeof utools !== 'undefined' && utools.copyText) {
    utools.copyText(text);
    showToast(CONSTANTS.SUCCESS_MESSAGES.COPY_SUCCESS, 'success');
  } else {
    // 浏览器环境下使用 navigator.clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(CONSTANTS.SUCCESS_MESSAGES.COPY_SUCCESS, 'success');
      }).catch(err => {
        console.error('复制失败:', err);
        showToast(CONSTANTS.ERROR_TOAST_MESSAGES.COPY_FAILED, 'error');
      });
    } else {
      console.error('uTools API is not available.');
    }
  }
}

function convertAndCopy() {
  const result = convert();
  if (result && !result.startsWith('// Invalid JSON input') && !result.startsWith('// 转换失败')) {
    copyToClipboard();
  } else {
    showToast(CONSTANTS.ERROR_TOAST_MESSAGES.CONVERSION_FAILED, 'error');
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');

  // 清除之前的类名
  toast.className = 'toast';

  // 根据类型添加相应的类名
  if (type === 'error') {
    toast.className = 'toast error show';
  } else if (type === 'warning') {
    toast.className = 'toast warning show';
  } else {
    toast.className = 'toast show';
  }

  toast.innerText = message;
  setTimeout(() => {
    toast.className = toast.className.replace('show', '');
  }, CONSTANTS.TOAST_DURATION);
}

// 换行切换功能
function toggleWrap() {
  const wrapToggle = getElement('wrapToggle');
  const outputText = getElement('outputText');

  // 检查当前是否为换行模式
  const isWrapping = outputText.style.whiteSpace !== 'nowrap';

  if (isWrapping) {
    // 当前是换行模式，切换到不换行模式
    outputText.style.whiteSpace = 'nowrap';
    outputText.style.overflowX = 'auto';
    wrapToggle.textContent = '↦不换行';
    wrapToggle.classList.remove('active');
  } else {
    // 当前是不换行模式，切换到换行模式
    outputText.style.whiteSpace = 'pre-wrap';
    outputText.style.overflowX = 'visible';
    wrapToggle.textContent = '↧换行';
    wrapToggle.classList.add('active');
  }
}

// 初始化换行状态
document.addEventListener('DOMContentLoaded', function () {
  const wrapToggle = getElement('wrapToggle');
  const outputText = getElement('outputText');

  // 默认为换行模式
  outputText.style.whiteSpace = 'pre-wrap';
  outputText.style.overflowX = 'visible';
  wrapToggle.textContent = '↧换行';
  wrapToggle.classList.add('active');
});

// uTools插件入口处理
if (typeof utools !== 'undefined' && utools.onPluginEnter) {
  utools.onPluginEnter(({ code, payload }) => {
    if (code && payload) {
      const inputElement = getElement('inputText');
      if (inputElement) {
        inputElement.value = payload;
        convert();
      }
    }
  });
}

// 粘贴功能
function pasteFromClipboard() {
  if (typeof utools !== 'undefined' && utools.readClipboard) {
    const clipboardText = utools.readClipboard();
    if (clipboardText) {
      getElement('inputText').value = clipboardText;
      // 粘贴后自动转换
      const result = convert();
      if (result && !result.startsWith('// Invalid JSON input') && !result.startsWith('// 转换失败')) {
        copyToClipboard();
      }
      showToast(CONSTANTS.SUCCESS_MESSAGES.PASTE_SUCCESS, 'success');
    }
  } else {
    // 浏览器环境下使用 navigator.clipboard
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(text => {
        getElement('inputText').value = text;
        const result = convert();
        if (result && !result.startsWith('// Invalid JSON input') && !result.startsWith('// 转换失败')) {
          copyToClipboard();
        }
        showToast(CONSTANTS.SUCCESS_MESSAGES.PASTE_SUCCESS, 'success');
      }).catch(err => {
        console.error('粘贴失败:', err);
        showToast(CONSTANTS.ERROR_TOAST_MESSAGES.PASTE_FAILED, 'error');
      });
    }
  }
}

// 添加自动转换功能

// 使用事件委托，避免在DOM加载前访问元素
document.addEventListener('DOMContentLoaded', function () {
  const inputTextArea = getElement('inputText');

  const debouncedConvert = debounce(function () {
    const inputText = inputTextArea.value.trim();
    if (inputText) {
      const result = convert();
      // 如果转换成功且有输出，则自动复制
      if (result && !result.startsWith('// Invalid JSON input') && !result.startsWith('// 转换失败')) {
        copyToClipboard();
      }
    }
  }, CONSTANTS.DEBOUNCE_DELAY);

  inputTextArea.addEventListener('input', debouncedConvert);

  // 添加右键菜单功能
  inputTextArea.addEventListener('contextmenu', function (e) {
    e.preventDefault();

    // 移除已存在的右键菜单
    const existingMenu = document.getElementById('contextMenu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // 创建右键菜单
    const contextMenu = document.createElement('div');
    contextMenu.id = 'contextMenu';
    contextMenu.style.cssText = `
      position: fixed;
      top: ${e.clientY}px;
      left: ${e.clientX}px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
      min-width: 120px;
    `;

    // 创建粘贴选项
    const pasteOption = document.createElement('div');
    pasteOption.textContent = '粘贴';
    pasteOption.style.cssText = `
      padding: 10px 15px;
      cursor: pointer;
      font-size: 14px;
      color: #333;
    `;
    pasteOption.addEventListener('mouseenter', function () {
      this.style.backgroundColor = '#f0f0f0';
    });
    pasteOption.addEventListener('mouseleave', function () {
      this.style.backgroundColor = 'transparent';
    });
    pasteOption.addEventListener('click', function () {
      pasteFromClipboard();
      contextMenu.remove();
    });

    // 创建清空选项
    const clearOption = document.createElement('div');
    clearOption.textContent = '清空';
    clearOption.style.cssText = `
      padding: 10px 15px;
      cursor: pointer;
      font-size: 14px;
      color: #333;
      border-top: 1px solid #eee;
    `;
    clearOption.addEventListener('mouseenter', function () {
      this.style.backgroundColor = '#f0f0f0';
    });
    clearOption.addEventListener('mouseleave', function () {
      this.style.backgroundColor = 'transparent';
    });
    clearOption.addEventListener('click', function () {
      getElement('inputText').value = '';
      getElement('outputText').value = '';
      contextMenu.remove();
      showToast(CONSTANTS.SUCCESS_MESSAGES.CLEAR_SUCCESS, 'success');
    });

    contextMenu.appendChild(pasteOption);
    contextMenu.appendChild(clearOption);
    document.body.appendChild(contextMenu);

    // 点击其他地方关闭菜单
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        contextMenu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 100);
  });
});