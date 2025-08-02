const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const { executeBackup } = require('../../utils/backupManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('サーバーの構成をバックアップします。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('バックアップ用のファイル名を指定します。')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.user.id;
    const backupName = interaction.options.getString('name');

    try {
      const backupFileName = await executeBackup({
        guild: interaction.guild,
        userId,
        backupName,
        isAuto: false,
      });
      await interaction.editReply({
        content: `サーバーのバックアップが完了しました。\nファイル: ${backupFileName}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('[エラー] バックアップに失敗しました。', error);
      await interaction.editReply({
        content: `バックアップに失敗しました。詳細: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
