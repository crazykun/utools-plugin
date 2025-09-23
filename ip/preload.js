const https = require('https');

window.services = {
  baidu: (ip) => {
    return new Promise((resolve, reject) => {
      https.get(
        `https://qifu.baidu.com/api/v1/ip-portrait/brief-info?ip=${ip}`,
        {
          headers: {
            "Accept": "*/*",
            "Referer": `https://qifu.baidu.com/?activeKey=SEARCH_IP&trace=apistore_ip_aladdin&activeId=SEARCH_IP_ADDRESS&ip=${ip}`,
            "User-Agent": "utools/1.0",
            "Connection": "keep-alive"
          }
        },
        (response) => {
          let data = '';
          response.on('data', (chunk) => data += chunk);
          response.on('end', () => resolve(JSON.parse(data)));
        }
      ).on('error', reject);
    });
  },
  qqzeng: (ip) => { 
    return new Promise((resolve, reject) => {
      timestamp = Date.now();
      rand = Math.floor(Math.random() * 1000);
      https.get(
        `https://www.qqzeng-ip.com/api/ip?callback=jsonpCallback_${timestamp}_${rand}&ip=${ip}`,
        (response) => {
          let data = '';
          response.on('data', (chunk) => data += chunk);
          response.on('end', () => {
            // 处理JSONP响应，提取其中的JSON部分
            const jsonpPrefix = data.indexOf('(');
            const jsonpSuffix = data.lastIndexOf(')');
            if (jsonpPrefix !== -1 && jsonpSuffix !== -1 && jsonpSuffix > jsonpPrefix) {
              const jsonString = data.substring(jsonpPrefix + 1, jsonpSuffix);
              const jsonData = JSON.parse(jsonString);
              resolve(jsonData);
            } else {
              // 如果不是预期的JSONP格式，直接返回原始数据
              resolve(data);
            }
          });
        }
      ).on('error', reject);
    });
  }
};