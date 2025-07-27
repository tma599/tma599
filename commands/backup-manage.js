const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup-manage')
    .setDescription('バックアップファイルの管理を行います。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('実行する操作を選択してください。')
        .setRequired(true)
        .addChoices(
          { name: 'list', value: 'list' },
          { name: 'lock', value: 'lock' },
          { name: 'unlock', value: 'unlock' },
          { name: 'delete', value: 'delete' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('対象のバックアップファイル名 (lock, unlock, delete の場合)')
        .setRequired(false)
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
