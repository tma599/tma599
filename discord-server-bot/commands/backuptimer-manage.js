const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

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
    // コマンドの実行ロジックは後で移動します
  },
};
