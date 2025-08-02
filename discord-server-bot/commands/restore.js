const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

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
          .filter((file) => file.endsWith('.json') && file.startsWith(focusedOption.value))
          .map((file) => file.replace('.json', ''));
        await interaction.respond(choices.map((choice) => ({ name: choice, value: choice })));
      } catch {
        await interaction.respond([]);
      }
    }
  },
  async execute(interaction) {
    // コマンドの実行ロジックは後で移動します
  },
};
