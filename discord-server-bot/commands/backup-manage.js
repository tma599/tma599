const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const fsp = require('fs/promises');
const path = require('path');
const { getBackupDir, ensureBackupDir } = require('../../utils/backupManager');

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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const action = interaction.options.getString('action');
    const fileName = interaction.options.getString('name');
    const userId = interaction.user.id;
    const backupDir = getBackupDir(userId);

    try {
      await ensureBackupDir(userId);

      if (action === 'list') {
        if (fileName) {
          await interaction.followUp({
            content:
              '「list」アクションではファイル名の指定は不要です。全てのバックアップを表示します。',
          });
        }
        const files = await fsp.readdir(backupDir);
        const backupFiles = files.filter((file) => file.endsWith('.json'));

        if (backupFiles.length === 0) {
          return interaction.editReply({
            content: 'あなたにはバックアップファイルは存在しません。',
            flags: MessageFlags.Ephemeral,
          });
        }

        const fileListPromises = backupFiles.map(async (file) => {
          try {
            const filePath = path.join(backupDir, file);
            const data = await fsp.readFile(filePath, 'utf-8');
            const json = JSON.parse(data);
            const serverInfo = json.serverName ? `(${json.serverName})` : '';
            return json.locked ? `🔒 \`${file}\` ${serverInfo}` : `✅ \`${file}\` ${serverInfo}`;
          } catch {
            return `❌ \`${file}\` (読み取り不可)`;
          }
        });

        const fileList = (await Promise.all(fileListPromises)).join('\n');
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('あなたの個人用バックアップ一覧')
          .setDescription(fileList || 'バックアップはありません。')
          .setTimestamp();
        await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        if (!fileName) {
          return interaction.reply({
            content: 'この操作にはファイル名の指定が必要です。',
            flags: MessageFlags.Ephemeral,
          });
        }
        const backupFileName = `${fileName}.json`;
        const backupFilePath = path.join(backupDir, backupFileName);

        try {
          await fsp.access(backupFilePath);
        } catch (error) {
          return interaction.editReply({
            content: `バックアップファイル「${backupFileName}」が見つかりません。`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const fileData = await fsp.readFile(backupFilePath, 'utf-8');
        const backupJson = JSON.parse(fileData);

        if (action === 'lock') {
          if (backupJson.locked) {
            return interaction.editReply({
              content: `ファイル「${backupFileName}」は既にロックされています。`,
              flags: MessageFlags.Ephemeral,
            });
          }
          backupJson.locked = true;
          await fsp.writeFile(backupFilePath, JSON.stringify(backupJson, null, 2));
          console.log(
            `[管理] ユーザー ${interaction.user.tag} がバックアップファイル "${backupFileName}" をロックしました。`
          );
          await interaction.editReply({
            content: `ファイル「${backupFileName}」をロックしました。`,
            flags: MessageFlags.Ephemeral,
          });
        } else if (action === 'unlock') {
          if (!backupJson.locked) {
            return interaction.editReply({
              content: `ファイル「${backupFileName}」はロックされていません。`,
              flags: MessageFlags.Ephemeral,
            });
          }
          backupJson.locked = false;
          await fsp.writeFile(backupFilePath, JSON.stringify(backupJson, null, 2));
          console.log(
            `[管理] ユーザー ${interaction.user.tag} がバックアップファイル "${backupFileName}" のロックを解除しました。`
          );
          await interaction.editReply({
            content: `ファイル「${backupFileName}」のロックを解除しました。`,
            flags: MessageFlags.Ephemeral,
          });
        } else if (action === 'delete') {
          if (backupJson.locked) {
            console.log(
              `[管理] ユーザー ${interaction.user.tag} がロックされたファイル "${backupFileName}" の削除を試みました。`
            );
            return interaction.editReply({
              content: `ファイル「${backupFileName}」はロックされているため削除できません。`,
              flags: MessageFlags.Ephemeral,
            });
          }
          await fsp.unlink(backupFilePath);
          console.log(
            `[管理] ユーザー ${interaction.user.tag} がバックアップファイル "${backupFileName}" を削除しました。`
          );
          await interaction.editReply({
            content: `ファイル「${backupFileName}」を削除しました。`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } catch (error) {
      console.error(`[エラー] バックアップ管理コマンド (${action}) の実行に失敗しました。`, error);
      await interaction.editReply({
        content: '操作に失敗しました。コンソールログを確認してください。',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
