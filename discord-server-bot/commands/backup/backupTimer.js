const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');
const { executeBackup } = require('../../utils/backupManager');
const { backupSchedules, saveSchedules } = require('../../models/backupSchedules');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backuptimer')
    .setDescription('バックアップの自動スケジュールを設定します。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('schedule')
        .setDescription('スケジュールを設定します。')
        .setRequired(true)
        .addChoices({ name: 'everyday', value: 'everyday' })
    )
    .addStringOption((option) =>
      option
        .setName('time')
        .setDescription('時間帯を選択してください。')
        .setRequired(true)
        .addChoices({ name: 'AM', value: 'AM' }, { name: 'PM', value: 'PM' })
    )
    .addIntegerOption((option) =>
      option
        .setName('hour')
        .setDescription('時間 (0-23)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(23)
    )
    .addIntegerOption((option) =>
      option
        .setName('minute')
        .setDescription('分 (0-59)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(59)
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const schedule = interaction.options.getString('schedule'); // eslint-disable-line no-unused-vars
    const time = interaction.options.getString('time');
    const hour = interaction.options.getInteger('hour');
    const minute = interaction.options.getInteger('minute');
    const guild = interaction.guild;
    const userId = interaction.user.id;

    let cronHour = hour;
    if (time === 'PM' && hour < 12) {
      cronHour += 12;
    }
    if (time === 'AM' && hour === 12) {
      cronHour = 0;
    }

    const cronString = `${minute} ${cronHour} * * *`;

    if (backupSchedules.has(guild.id)) {
      const existingTask = backupSchedules.get(guild.id).task;
      if (existingTask) {
        existingTask.stop();
      }
    }

    const task = cron.schedule(cronString, async () => {
      console.log(`[自動バックアップ] サーバー "${guild.name}" のバックアップを開始します。`);
      try {
        await executeBackup({ guild, userId, isAuto: true });
        console.log(`[自動バックアップ] サーバー "${guild.name}" のバックアップが完了しました。`);
      } catch (error) {
        console.error(`[エラー] 自動バックアップに失敗しました (サーバー: ${guild.name})`, error);
      }
    });

    backupSchedules.set(guild.id, { cronString, userId, task });
    await saveSchedules();

    await interaction.editReply({
      content: `自動バックアップをスケジュールしました: ${cronString}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
