const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetUser = interaction.options.getUser('user');
    const deleteCount = interaction.options.getInteger('count');
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const channel = interaction.channel;

    if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.editReply({
        content: 'このコマンドを使用するには、メッセージの管理権限が必要です。',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!targetUser || !deleteCount) {
      return interaction.editReply({
        content: 'ユーザーと削除件数を指定してください。',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!channel.isTextBased()) {
      return interaction.editReply({
        content: 'このコマンドはテキストチャンネルでのみ使用できます。',
        flags: MessageFlags.Ephemeral,
      });
    }

    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    let deletedMessagesCount = 0;

    try {
      console.log(
        `[削除] チャンネル "${channel.name}" (ID: ${channel.id}) のメッセージ削除処理を開始します。`
      );
      const messages = await channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(
        (m) => m.author.id === targetUser.id && m.createdTimestamp > twoWeeksAgo
      );

      const messagesToDelete = Array.from(userMessages.values()).slice(0, deleteCount);
      if (messagesToDelete.length > 0) {
        const deleted = await channel.bulkDelete(messagesToDelete, true);
        deletedMessagesCount = deleted.size;
      }

      console.log(
        `[削除] ユーザー "${targetUser.tag}" のメッセージを ${deletedMessagesCount} 件削除しました。`
      );
      await interaction.editReply({
        content: `ユーザー「${targetUser.tag}」のメッセージを ${deletedMessagesCount} 件削除しました。`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('[エラー] メッセージ削除中にエラーが発生しました。', error);
      await interaction.editReply({
        content: 'メッセージの削除中にエラーが発生しました。コンソールログを確認してください。',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
