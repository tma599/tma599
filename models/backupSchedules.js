const fsp = require('fs/promises');
const path = require('path');
const cron = require('node-cron');
const { executeBackup } = require('../utils/backupManager');

const schedulesFilePath = path.join(__dirname, '../schedules.json');
let backupSchedules = new Map();

async function saveSchedules() {
  const serializableSchedules = new Map();
  for (const [guildId, schedule] of backupSchedules.entries()) {
    const { task, ...serializableSchedule } = schedule;
    serializableSchedules.set(guildId, serializableSchedule);
  }
  const data = JSON.stringify(Array.from(serializableSchedules.entries()), null, 2);
  await fsp.writeFile(schedulesFilePath, data);
}

async function loadSchedules(client) {
  try {
    await fsp.access(schedulesFilePath);
    const data = await fsp.readFile(schedulesFilePath, 'utf-8');
    const schedules = new Map(JSON.parse(data));
    for (const [guildId, schedule] of schedules.entries()) {
      const guild = await client.guilds.fetch(guildId);
      if (guild) {
        const task = cron.schedule(schedule.cronString, async () => {
          console.log(`[自動バックアップ] サーバー "${guild.name}" のバックアップを開始します。`);
          try {
            await executeBackup(guild, schedule.userId, null, true);
            console.log(
              `[自動バックアップ] サーバー "${guild.name}" のバックアップが完了しました。`
            );
          } catch (error) {
            console.error(
              `[エラー] 自動バックアップに失敗しました (サーバー: ${guild.name})`,
              error
            );
          }
        });
        backupSchedules.set(guildId, { ...schedule, task });
      }
    }
    console.log('[起動] 保存されているバックアップスケジュールを読み込みました。');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[起動] スケジュールファイルが見つかりません。新しく作成します。');
    } else {
      console.error('[エラー] スケジュールの読み込みに失敗しました。', error);
    }
  }
}

module.exports = { backupSchedules, saveSchedules, loadSchedules };
