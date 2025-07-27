const fsp = require('fs/promises');
const path = require('path');

const reactionRolesFilePath = path.join(__dirname, '../reactionRoles.json');
let reactionRoles = new Map(); // Map<messageId, Map<emoji, roleId>>

async function saveReactionRoles() {
  const serializableReactionRoles = {};
  for (const [messageId, emojiMap] of reactionRoles.entries()) {
    serializableReactionRoles[messageId] = {};
    for (const [emoji, roleId] of emojiMap.entries()) {
      serializableReactionRoles[messageId][emoji] = roleId;
    }
  }
  const data = JSON.stringify(serializableReactionRoles, null, 2);
  await fsp.writeFile(reactionRolesFilePath, data);
}

async function loadReactionRoles() {
  try {
    await fsp.access(reactionRolesFilePath);
    const data = await fsp.readFile(reactionRolesFilePath, 'utf-8');
    const loadedData = JSON.parse(data);
    reactionRoles = new Map();
    for (const messageId in loadedData) {
      const emojiMap = new Map();
      for (const emoji in loadedData[messageId]) {
        emojiMap.set(emoji, loadedData[messageId][emoji]);
      }
      reactionRoles.set(messageId, emojiMap);
    }
    console.log('[起動] 保存されているリアクションロール設定を読み込みました。');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[起動] リアクションロール設定ファイルが見つかりません。新しく作成します。');
    } else {
      console.error('[エラー] リアクションロール設定の読み込みに失敗しました。', error);
    }
  }
}

module.exports = { reactionRoles, saveReactionRoles, loadReactionRoles };
