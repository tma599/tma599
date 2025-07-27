const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { reactionRoles, saveReactionRoles } = require('../../models/reactionRoles');

function getEmojiIdentifier(emoji) {
  const customEmojiRegex = /<:(\w+):(\d+)>/;
  const match = emoji.match(customEmojiRegex);
  if (match) {
    return match[2]; // カスタム絵文字の場合はIDを返す
  }
  return emoji; // ユニコード絵文字の場合はそのまま返す
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('リアクションロールを設定します。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles) // ロール管理権限が必要

    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('リアクションロールを削除します。')
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('リアクションロールを削除するメッセージのID')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('emoji')
            .setDescription('削除するリアクションロールの絵文字')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('設定されているリアクションロールの一覧を表示します。')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('ボットがメッセージを送信し、リアクションロールを設定します。')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('メッセージを送信するチャンネル')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('ボットが送信するメッセージの内容')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('emojis')
            .setDescription('リアクションに使用する絵文字 (改行区切りで複数指定)')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('roles')
            .setDescription('付与するロール (改行区切りで複数指定)')
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'remove') {
      const messageId = interaction.options.getString('message_id');
      const emojiInput = interaction.options.getString('emoji');
      const emojiIdentifier = getEmojiIdentifier(emojiInput);

      if (!reactionRoles.has(messageId)) {
        return interaction.reply({
          content: 'そのメッセージにはリアクションロールが設定されていません。',
          flags: MessageFlags.Ephemeral,
        });
      }

      const emojiMap = reactionRoles.get(messageId);
      if (!emojiMap.has(emojiIdentifier)) {
        return interaction.reply({
          content: 'その絵文字のリアクションロールは設定されていません。',
          flags: MessageFlags.Ephemeral,
        });
      }

      emojiMap.delete(emojiIdentifier);
      if (emojiMap.size === 0) {
        reactionRoles.delete(messageId);
      }
      await saveReactionRoles();

      try {
        const channel = interaction.channel;
        const message = await channel.messages.fetch(messageId);
        const reaction = message.reactions.cache.get(emojiIdentifier);
        if (reaction) {
          await reaction.remove();
        }
      } catch (e) {
        console.error(
          `[リアクションロール] 絵文字 ${emojiInput} のリアクション削除に失敗しました:`,
          e
        );
      }

      await interaction.reply({
        content: `メッセージID ${messageId} から絵文字 ${emojiInput} のリアクションロールを削除しました。`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'list') {
      if (reactionRoles.size === 0) {
        return interaction.reply({
          content: '現在、設定されているリアクションロールはありません。',
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('設定されているリアクションロール一覧');

      let description = '';
      for (const [messageId, emojiMap] of reactionRoles.entries()) {
        description += `**メッセージID: ${messageId}**\n`;
        for (const [emoji, roleId] of emojiMap.entries()) {
          const role = interaction.guild.roles.cache.get(roleId);
          description += `  ${emoji} -> ${role ? role.name : '不明なロール'} (ID: ${roleId})\n`;
        }
        description += '\n';
      }
      embed.setDescription(description);

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (subcommand === 'create') {
      const channel = interaction.options.getChannel('channel');
      const messageContent = interaction.options.getString('message');
      const emojisInput = interaction.options.getString('emojis');
      const rolesInput = interaction.options.getString('roles');

      const emojis = emojisInput.split('\n');
      const roleNames = rolesInput.split('\n');

      if (emojis.length !== roleNames.length) {
        return interaction.reply({
          content: '絵文字とロールの数が一致しません。',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const sentMessage = await channel.send(messageContent);
        const messageId = sentMessage.id;

        if (!reactionRoles.has(messageId)) {
          reactionRoles.set(messageId, new Map());
        }
        const emojiMap = reactionRoles.get(messageId);

        for (let i = 0; i < emojis.length; i++) {
          const emojiInput = emojis[i];
          const roleName = roleNames[i];
          const emojiIdentifier = getEmojiIdentifier(emojiInput);

          const role = interaction.guild.roles.cache.find((r) => r.name === roleName);
          if (!role) {
            await interaction.followUp({
              content: `ロール名「${roleName}」が見つかりません。`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (emojiMap.has(emojiIdentifier)) {
            await interaction.followUp({
              content: `絵文字 ${emojiInput} は既にこのメッセージに設定されています。`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          emojiMap.set(emojiIdentifier, role.id);
          await sentMessage.react(emojiInput);
        }

        await saveReactionRoles();

        await interaction.editReply({
          content: `リアクションロールメッセージを送信し、設定しました。メッセージID: ${messageId}`,
        });
      } catch (error) {
        console.error(
          '[リアクションロール] リアクションロールの作成中にエラーが発生しました:',
          error
        );
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: 'リアクションロールメッセージの作成に失敗しました。',
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: 'リアクションロールメッセージの作成に失敗しました。',
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
  },
};
