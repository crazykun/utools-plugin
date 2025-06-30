const https = require('https');

window.services = {
  baidu: (ip) => {
    return new Promise((resolve, reject) => {
      https.get(
        `https://qifu.baidu.com/ip/geo/v1/district?ip=${ip}`,
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
  }
};