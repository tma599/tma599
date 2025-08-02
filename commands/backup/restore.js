const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const fsp = require('fs/promises');
const path = require('path');
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
    if (focusedOption.name !== 'name') return;

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    // The user reported the old structure as serverId/userId
    const oldBackupDir = path.join(__dirname, '..', '..', 'backups', guildId, userId);
    // The new structure for manual backups is just userId
    const newBackupDir = path.join(__dirname, '..', '..', 'backups', userId);

    let allFiles = [];
    try {
      const oldFiles = await fsp.readdir(oldBackupDir);
      allFiles.push(...oldFiles);
    } catch (err) {
      // Ignore errors if the directory doesn't exist
    }
    try {
      const newFiles = await fsp.readdir(newBackupDir);
      allFiles.push(...newFiles);
    } catch (err) {
      // Ignore errors if the directory doesn't exist
    }

    // Use a Set to get unique filenames
    const uniqueFiles = [...new Set(allFiles)];

    const choices = uniqueFiles
      .filter(
        (file) =>
          !file.startsWith('auto_') &&
          file.endsWith('.json') &&
          file.toLowerCase().startsWith(focusedOption.value.toLowerCase())
      )
      .map((file) => file.replace('.json', ''));

    // Discord has a limit of 25 choices
    await interaction.respond(
      choices.slice(0, 25).map((choice) => ({ name: choice, value: choice }))
    );
  },
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const backupName = interaction.options.getString('name');
    const backupFileName = `${backupName}.json`;

    // Define potential paths for the backup file
    const newBackupPath = path.join(__dirname, '..', '..', 'backups', userId, backupFileName);
    const oldBackupPath = path.join(
      __dirname,
      '..',
      '..',
      'backups',
      guildId,
      userId,
      backupFileName
    );

    let backupFilePath = '';

    // Check for the backup file in the new location, then the old one
    try {
      await fsp.access(newBackupPath);
      backupFilePath = newBackupPath;
    } catch (error) {
      try {
        await fsp.access(oldBackupPath);
        backupFilePath = oldBackupPath;
      } catch (nestedError) {
        console.log(
          `[復元] ユーザー ${interaction.user.tag} が存在しないバックアップファイル "${backupFileName}" を指定しました。`
        );
        return interaction.editReply({
          content: `あなたのバックアップファイル「${backupFileName}」が見つかりません。`,
          flags: MessageFlags.Ephemeral,
        });
      }
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
