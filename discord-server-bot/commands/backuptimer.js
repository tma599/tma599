const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

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
    // コマンドの実行ロジックは後で移動します
  },
};
