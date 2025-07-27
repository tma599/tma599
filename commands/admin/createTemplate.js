const {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  PermissionsBitField,
} = require('discord.js');
const fsp = require('fs/promises');
const path = require('path');
const { getBackupDir } = require('../../utils/backupManager');
const { applyBackup } = require('../../utils/backupRestorer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-template')
    .setDescription('オーナーのテンプレートでサーバーを上書き構築します。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const ownerId = '1068465891743899698';
    const backupName = 'template';
    const backupFileName = `${backupName}.json`;
    const backupFilePath = path.join(getBackupDir(ownerId), backupFileName);

    try {
      await fsp.access(backupFilePath);
    } catch (error) {
      console.log(
        `[テンプレート] オーナー (ID: ${ownerId}) のテンプレートファイルが見つかりません。`
      );
      return interaction.editReply({
        content: `オーナーのテンプレートファイル (${backupFileName}) が見つかりません。`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_template')
      .setLabel('はい、上書きします')
      .setStyle(ButtonStyle.Danger);
    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_template')
      .setLabel('いいえ、やめます')
      .setStyle(ButtonStyle.Secondary);
    const row1 = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const warning1 = await interaction.editReply({
      content: `⚠️ **警告: サーバー上書き** ⚠️\nこの操作を実行すると、まずテンプレートの内容が復元され、その後、**テンプレートに存在しない全てのチャンネルがサーバーから削除されます。** この操作は元に戻せません。\n\n本当に続行しますか？`,
      components: [row1],
      fetchReply: true,
      flags: MessageFlags.Ephemeral,
    });

    try {
      const collectorFilter = (i) => i.user.id === interaction.user.id;
      const confirmation1 = await warning1.awaitMessageComponent({
        filter: collectorFilter,
        time: 30_000,
      });

      if (confirmation1.customId === 'cancel_template') {
        return confirmation1.update({ content: '操作はキャンセルされました。', components: [] });
      }

      const confirmButton2 = new ButtonBuilder()
        .setCustomId('confirm_final')
        .setLabel('はい、実行します')
        .setStyle(ButtonStyle.Danger);
      const cancelButton2 = new ButtonBuilder()
        .setCustomId('cancel_final')
        .setLabel('いいえ、やはり中止します')
        .setStyle(ButtonStyle.Secondary);
      const row2 = new ActionRowBuilder().addComponents(confirmButton2, cancelButton2);

      await confirmation1.update({
        content:
          '🚨 **最終確認** 🚨\n本当によろしいですか？ **テンプレートにないチャンネルは、このコマンドを打ったチャンネルも含めて全て削除されます。**',
        components: [row2],
      });

      const confirmation2 = await warning1.awaitMessageComponent({
        filter: collectorFilter,
        time: 30_000,
      });

      if (confirmation2.customId === 'cancel_final') {
        return confirmation2.update({ content: '操作はキャンセルされました。', components: [] });
      }

      await confirmation2.update({
        content: '確認が取れました。テンプレートを適用し、完了後に不要なチャンネルを削除します...',
        components: [],
      });

      const backupData = JSON.parse(await fsp.readFile(backupFilePath, 'utf-8'));
      const guild = interaction.guild;

      await interaction.followUp({
        content: 'テンプレートの適用を開始します...',
        flags: MessageFlags.Ephemeral,
      });
      await applyBackup(guild, backupData, true);
      await interaction.followUp({
        content: 'テンプレートの適用が完了しました。',
        flags: MessageFlags.Ephemeral,
      });

      await interaction.followUp({
        content: '不要なチャンネルの削除を開始します...',
        flags: MessageFlags.Ephemeral,
      });
      const backupChannelNames = new Set(backupData.channels.map((c) => c.name));
      const interactionChannelId = interaction.channelId;

      await guild.channels.fetch();

      const channelsToDelete = guild.channels.cache.filter(
        (channel) => !backupChannelNames.has(channel.name) && channel.id !== interactionChannelId
      );

      console.log(`[テンプレート] ${channelsToDelete.size}個の不要なチャンネルを削除します。`);
      for (const channel of channelsToDelete.values()) {
        try {
          await channel.delete('Template overwrite cleanup');
          console.log(`[テンプレート] チャンネル "${channel.name}" を削除しました。`);
        } catch (err) {
          console.error(
            `[エラー] テンプレートクリーンアップ中にチャンネル "${channel.name}" の削除に失敗しました。`,
            err
          );
        }
      }

      const interactionChannel = guild.channels.cache.get(interactionChannelId);
      if (interactionChannel && !backupChannelNames.has(interactionChannel.name)) {
        try {
          await interaction.followUp({
            content: '最後に、この応答用チャンネルを削除します。',
            flags: MessageFlags.Ephemeral,
          });
          await interactionChannel.delete('Template overwrite cleanup');
          console.log(
            `[テンプレート] 応答用チャンネル "${interactionChannel.name}" を削除しました。`
          );
        } catch (err) {
          console.error(
            `[エラー] 応答用チャンネル "${interactionChannel.name}" の削除に失敗しました。`,
            err
          );
        }
      }
    } catch (err) {
      console.error('[エラー] テンプレート適用中にエラーが発生しました。', err);
      await interaction.editReply({
        content: '確認がタイムアウトしたか、エラーが発生したため操作を中止しました。',
        components: [],
      });
    }
  },
};
