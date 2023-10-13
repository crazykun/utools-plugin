function generateId() {
  const length = 8; // ID 的长度
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789"; // 可选字符集合
  let id = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    const randomChar = characters[randomIndex];
    id += randomChar;
  }

  return id;
}
