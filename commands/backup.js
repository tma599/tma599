const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

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
    // コマンドの実行ロジックは後で移動します
  },
};
