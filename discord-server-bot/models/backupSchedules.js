const fsp = require('fs/promises');
const path = require('path');
const cron = require('node-cron');
const { CronExpressionParser } = require('cron-parser');
const { executeBackup } = require('../utils/backupManager');

const schedulesFilePath = path.join(__dirname, '../schedules.json');
let backupSchedules = new Map();

async function saveSchedules() {
  const dataToSave = {};
  for (const [guildId, schedules] of backupSchedules.entries()) {
    dataToSave[guildId] = schedules.map(({ task, ...rest }) => rest);
  }
  await fsp.writeFile(schedulesFilePath, JSON.stringify(dataToSave, null, 2));
}

async function loadSchedules(client) {
  try {
    const data = await fsp.readFile(schedulesFilePath, 'utf-8');
    const schedulesFromFile = JSON.parse(data);

    for (const guildId in schedulesFromFile) {
      const schedules = schedulesFromFile[guildId];
      if (Array.isArray(schedules)) {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          const liveSchedules = [];
          for (const scheduleData of schedules) {
            try {
              if (!cron.validate(scheduleData.cronTime)) {
                console.error(
                  `[エラー] スケジュール「${scheduleData.cronTime}」は無効な形式です。スキップします。`
                );
                continue;
              }
              const task = cron.schedule(
                scheduleData.cronTime,
                async () => {
                  console.log(
                    `[自動バックアップ] サーバー "${guild.name}" のバックアップを開始します (スケジュール: ${scheduleData.cronTime})。`
                  );
                  try {
                    await executeBackup({ guild, userId: scheduleData.userId, isAuto: true });
                    console.log(
                      `[自動バックアップ] サーバー "${guild.name}" のバックアップが完了しました。`
                    );
                  } catch (error) {
                    console.error(
                      `[エラー] 自動バックアップに失敗しました (サーバー: ${guild.name})`,
                      error
                    );
                  }
                },
                { timezone: 'Asia/Tokyo' }
              );

              const interval = CronExpressionParser.parse(scheduleData.cronTime, {
                tz: 'Asia/Tokyo',
              });
              const nextRun = interval.next().toDate().toISOString();
              liveSchedules.push({ ...scheduleData, task, nextRun });
            } catch (e) {
              console.error(
                `[エラー] スケジュール「${scheduleData.cronTime}」の解析に失敗しました。スキップします。`,
                e
              );
              continue;
            }
          }
          backupSchedules.set(guildId, liveSchedules);
        }
      }
    }
    console.log('[起動] 保存されているバックアップスケジュールを読み込みました。');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[エラー] スケジュールの読み込みに失敗しました。', error);
    }
  }
}

async function addSchedule(client, guildId, cronTime, userId) {
  const guild = await client.guilds.fetch(guildId);
  if (!guild) throw new Error('Guild not found');

  let schedulesForGuild = backupSchedules.get(guildId) || [];

  if (schedulesForGuild.some((s) => s.cronTime === cronTime)) {
    throw new Error('This schedule already exists for this guild.');
  }

  const task = cron.schedule(
    cronTime,
    async () => {
      console.log(
        `[自動バックアップ] サーバー "${guild.name}" のバックアップを開始します (スケジュール: ${cronTime})。`
      );
      try {
        await executeBackup({ guild, userId, isAuto: true });
        console.log(`[自動バックアップ] サーバー "${guild.name}" のバックアップが完了しました。`);
      } catch (error) {
        console.error(`[エラー] 自動バックアップに失敗しました (サーバー: ${guild.name})`, error);
      }
    },
    { timezone: 'Asia/Tokyo' }
  );

  const interval = CronExpressionParser.parse(cronTime, { tz: 'Asia/Tokyo' });
  const newSchedule = {
    cronTime,
    userId,
    createdAt: new Date().toISOString(),
    nextRun: interval.next().toDate().toISOString(),
    task,
  };

  schedulesForGuild.push(newSchedule);
  backupSchedules.set(guildId, schedulesForGuild);
  await saveSchedules();
}

async function removeSchedule(guildId, cronTime) {
  let schedulesForGuild = backupSchedules.get(guildId) || [];
  const scheduleToRemove = schedulesForGuild.find((s) => s.cronTime === cronTime);

  if (scheduleToRemove && scheduleToRemove.task) {
    scheduleToRemove.task.stop();
    const updatedSchedules = schedulesForGuild.filter((s) => s.cronTime !== cronTime);
    backupSchedules.set(guildId, updatedSchedules);
    await saveSchedules();
  } else {
    throw new Error('Schedule not found or already stopped.');
  }
}

module.exports = { backupSchedules, saveSchedules, loadSchedules, addSchedule, removeSchedule };
