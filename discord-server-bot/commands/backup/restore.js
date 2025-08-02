const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const fsp = require('fs/promises');
const path = require('path');
const { getBackupDir } = require('../../utils/backupManager');
const { applyBackup } = require('../../utils/backupRestorer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restore')
    .setDescription('バックアップからサーバーを復元します。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('復元に使うバックアップのファイル名を指定します。')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'name') {
      const backupDir = getBackupDir(interaction.user.id);
      try {
        await fsp.access(backupDir);
        const files = await fsp.readdir(backupDir);
        const choices = files
          .filter(
            (file) =>
              !file.startsWith('auto_') &&
              file.endsWith('.json') &&
              file.startsWith(focusedOption.value)
          )
          .map((file) => file.replace('.json', ''));
        await interaction.respond(choices.map((choice) => ({ name: choice, value: choice })));
      } catch {
        await interaction.respond([]);
      }
    }
  },
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.user.id;
    const backupName = interaction.options.getString('name');
    const backupFileName = `${backupName}.json`;
    const backupFilePath = path.join(getBackupDir(userId), backupFileName);

    try {
      await fsp.access(backupFilePath);
    } catch (error) {
      console.log(
        `[復元] ユーザー ${interaction.user.tag} が存在しないバックアップファイル "${backupFileName}" を指定しました。`
      );
      return interaction.editReply({
        content: `あなたのバックアップファイル「${backupFileName}」が見つかりません。`,
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const backupData = JSON.parse(await fsp.readFile(backupFilePath, 'utf-8'));
      await interaction.editReply({
        content: 'バックアップからサーバーの復元を開始します...',
        flags: MessageFlags.Ephemeral,
      });
      await applyBackup(interaction.guild, backupData, false);
      await interaction.followUp({
        content: `バックアップ「${backupFileName}」からのサーバーの復元が完了しました。`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('[エラー] 復元に失敗しました。', error);
      await interaction.followUp({
        content: '復元に失敗しました。Botに必要な権限があるか、コンソールログを確認してください。',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
