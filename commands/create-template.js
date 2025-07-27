const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-template')
    .setDescription('オーナーのテンプレートでサーバーを上書き構築します。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
  async execute(interaction) {
    // コマンドの実行ロジックは後で移動します
  },
};
