// preload.js 中使用 nodejs
const crypto = require("crypto");

// 加密
window.encodeFn = function () {
  var fn = {
    md5: md5, //md5加密
    HmacMD5: HmacMD5, //HmacMD5加密
    SHA1: SHA1, //SHA1加密
    HmacSHA1: HmacSHA1, //HmacSHA1加密
    SHA256: SHA256, //SHA256加密
    HmacSHA256: HmacSHA256, //HmacSHA256加密
    HmacSHA512: HmacSHA512, //HmacSHA512加密
    RIPEMD160: RIPEMD160, //RIPEMD160加密
    AES: AES, //AES cbc加密
    AES2: AES2, //AES ecb加密
    DES: DES, //DES加密
  };
  return fn;
};
function md5(str) {
  const hash = crypto.createHash("md5");
  hash.update(str);
  return hash.digest("hex");
}

function HmacMD5(str, key) {
  const hmac = crypto.createHmac("md5", key);
  hmac.update(str);
  const encryptedMessage = hmac.digest("hex");
  return encryptedMessage;
}

function SHA1(str) {
  const hash = crypto.createHash("sha1");
  hash.update(str);
  const encryptedMessage = hash.digest("hex");
  return encryptedMessage;
}

function HmacSHA1(str, key) {
  const hmac = crypto.createHmac("sha1", key);
  hmac.update(str);
  const encryptedMessage = hmac.digest("hex");
  return encryptedMessage;
}

function SHA256(str) {
  const hmac = crypto.createHash("sha256");
  hmac.update(str);
  const encryptedMessage = hmac.digest("hex");
  return encryptedMessage;
}

function HmacSHA256(str, key) {
  const hmac = crypto.createHmac("sha256", key);
  hmac.update(str);
  const encryptedMessage = hmac.digest("hex");
  return encryptedMessage;
}


function HmacSHA512(str, key) {
  const hmac = crypto.createHmac("sha512", key);
  hmac.update(str);
  const encryptedMessage = hmac.digest("hex");
  return encryptedMessage;
}

function RIPEMD160(str) {
  const hash = crypto.createHash("ripemd160");
  hash.update(str);
  const encryptedMessage = hash.digest("hex");
  return encryptedMessage;
}

function AES(str, key, iv) {
  iv = fixlength(iv, 16);
  key = fixlength(key, 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(str, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function AES2(str, key) {
  key = fixlength(key, 32);
  const cipher = crypto.createCipheriv("aes-256-ecb", key, null);
  let encrypted = cipher.update(str, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function DES(str, key) {
  key = fixlength(key, 8);
  const cipher = crypto.createCipheriv("des-ecb", key, null);
  let encrypted = cipher.update(str, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}


// 解密
window.decodeFn = function () {
  var fn = {
    AES: _AES, //AES解密
    AES2: _AES2, //AES解密
    DES: _DES, //DES解密
  };
  return fn;
};

function _AES(str, key, iv) {
  iv = fixlength(iv, 16);
  key = fixlength(key, 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(str, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
function _AES2(str, key) {
  key = fixlength(key, 32);
  const decipher = crypto.createDecipheriv("aes-256-ecb", key, null);
  let decrypted = decipher.update(str, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function _DES(str, key) {
  key = fixlength(key, 8);
  const decipher = crypto.createDecipheriv("des-ecb", key, null);
  let decrypted = decipher.update(str, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}



function fixlength(str, lenght) {
  if (str.length < lenght) {
    str = str.padEnd(lenght, "0");
  } else if (str.length > lenght) {
    str = str.substring(0, lenght);
  }
  return str;  
}