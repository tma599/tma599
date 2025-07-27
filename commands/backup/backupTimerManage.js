const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const cron = require('node-cron');
const { backupSchedules, saveSchedules } = require('../../models/backupSchedules');
const { executeBackup } = require('../../utils/backupManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backuptimer-manage')
    .setDescription('自動バックアップの管理を行います。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('実行する操作を選択してください。')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' },
          { name: 'list', value: 'list' }
        )
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const action = interaction.options.getString('action');
    const guildId = interaction.guild.id;
    const client = interaction.client;

    if (action === 'on') {
      const scheduleData = backupSchedules.get(guildId);
      if (scheduleData) {
        if (scheduleData.task && scheduleData.task.running) {
          return interaction.editReply({ content: '自動バックアップは既にONになっています。' });
        }
        // スケジュールが停止しているか、タスクがない場合は再開
        const task = cron.schedule(scheduleData.cronString, async () => {
          console.log(
            `[自動バックアップ] サーバー "${interaction.guild.name}" のバックアップを開始します。`
          );
          try {
            await executeBackup(interaction.guild, scheduleData.userId, null, true);
            console.log(
              `[自動バックアップ] サーバー "${interaction.guild.name}" のバックアップが完了しました。`
            );
          } catch (error) {
            console.error(
              `[エラー] 自動バックアップに失敗しました (サーバー: ${interaction.guild.name})`,
              error
            );
          }
        });
        backupSchedules.set(guildId, { ...scheduleData, task });
        await saveSchedules();
        await interaction.editReply({ content: '自動バックアップをONにしました。' });
      } else {
        await interaction.editReply({
          content:
            'このサーバーには設定された自動バックアップがありません。/backuptimer コマンドで設定してください。',
        });
      }
    } else if (action === 'off') {
      const scheduleData = backupSchedules.get(guildId);
      if (scheduleData && scheduleData.task) {
        scheduleData.task.stop();
        backupSchedules.delete(guildId);
        await saveSchedules();
        await interaction.editReply({ content: '自動バックアップをOFFにしました。' });
      }
    } else if (action === 'list') {
      const schedules = Array.from(backupSchedules.entries());
      if (schedules.length === 0) {
        return interaction.editReply({
          content: 'このサーバーには自動バックアップスケジュールが設定されていません。',
        });
      }

      let description = '';
      for (const [guildId, scheduleData] of schedules) {
        const guild = client.guilds.cache.get(guildId);
        const guildName = guild ? guild.name : '不明なサーバー';
        description += `**サーバー:** ${guildName} (ID: ${guildId})\n`;
        description += `  **スケジュール:** ${scheduleData.cronString}\n`;
        description += `  **設定者ID:** ${scheduleData.userId}\n`;
        description += `  **ステータス:** ${scheduleData.task && scheduleData.task.running ? 'ON' : 'OFF'}\n`;
        description += '--------------------\n';
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('自動バックアップスケジュール一覧')
        .setDescription(description)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
