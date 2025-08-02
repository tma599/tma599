const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletemessage')
    .setDescription('指定されたユーザーのメッセージを指定された件数削除します。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('メッセージを削除するユーザーを指定します。')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('削除するメッセージの件数を指定します。(最大100件)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),
  async execute(interaction) {
    // コマンドの実行ロジックは後で移動します
  },
};
