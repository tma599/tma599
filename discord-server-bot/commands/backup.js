const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { executeBackup } = require('../utils/backupManager');

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
    const backupName = interaction.options.getString('name');
    const guild = interaction.guild;
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true }); // 応答を遅延させる

    try {
      const fileName = await executeBackup({ guild, userId, backupName });
      await interaction.editReply(`バックアップ「${fileName}」を作成しました。`);
    } catch (error) {
      console.error('[エラー] バックアップコマンドの実行に失敗しました:', error);
      await interaction.editReply(`バックアップの作成に失敗しました: ${error.message}`);
    }
  },
};
