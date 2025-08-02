const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { reactionRoles, saveReactionRoles } = require('../../models/reactionRoles');

// 絵文字の識別子を取得するヘルパー関数
function getEmojiIdentifier(emoji) {
  const customEmojiRegex = /<a?:(\w+):(\d+)>/;
  const match = emoji.match(customEmojiRegex);
  if (match) {
    return match[2]; // カスタム絵文字の場合はIDを返す
  }
  return emoji; // 標準絵文字の場合はそのまま返す
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('リアクションロールを設定します。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles), // ロール管理権限が必要
  async execute(interaction) {
    const guild = interaction.guild;
    const user = interaction.user;

    // プライベートチャンネルの作成
    const privateChannel = await guild.channels.create({
      name: `rr-config-${user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
        {
          id: interaction.client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
      ],
    });

    await interaction.reply({
      content: `${privateChannel} でリアクションロールの設定を開始します。`,
      flags: MessageFlags.Ephemeral,
    });

    await privateChannel.send('Botがメッセージを出力するチャンネル名を入力してください');

    // ここから対話形式のロジック
    const filter = (m) => m.author.id === user.id;
    const collector = privateChannel.createMessageCollector({ filter, time: 600000 }); // 10分間

    let step = 0;
    let config = {};
    let setupComplete = false;

    collector.on('collect', async (m) => {
      try {
        switch (step) {
          case 0:
            // チャンネルの指定
            const targetChannel =
              m.mentions.channels.first() || guild.channels.cache.find((c) => c.name === m.content);
            if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
              await privateChannel.send(
                '有効なテキストチャンネルをメンションまたはチャンネル名で入力してください。'
              );
              return;
            }
            config.targetChannel = targetChannel;
            await privateChannel.send('Botに出力させるメッセージの内容を入力してください');
            step++;
            break;
          case 1:
            // メッセージ内容の指定
            config.messageContent = m.content;
            await privateChannel.send(
              '絵文字を入力してください 半角スペース区切りで複数指定可能です'
            );
            step++;
            break;
          case 2:
            // 絵文字の指定
            const numberEmojiMap = {
              0: '0️⃣',
              1: '1️⃣',
              2: '2️⃣',
              3: '3️⃣',
              4: '4️⃣',
              5: '5️⃣',
              6: '6️⃣',
              7: '7️⃣',
              8: '8️⃣',
              9: '9️⃣',
            };
            config.emojis = m.content.split(' ').map((inputEmoji) => {
              // まず、数字をUnicode絵文字に変換
              let processedEmoji = inputEmoji;
              if (numberEmojiMap[inputEmoji]) {
                processedEmoji = numberEmojiMap[inputEmoji];
              }

              // 次に、カスタム絵文字のIDを抽出（標準絵文字はそのまま）
              return getEmojiIdentifier(processedEmoji);
            });
            await privateChannel.send(
              '絵文字に結びつけるロール名を入力してください 複数やる場合左から順に結びつきます'
            );
            step++;
            break;
          case 3:
            // ロール名の指定
            config.roleNames = m.content.split(' ');

            if (config.emojis.length !== config.roleNames.length) {
              await privateChannel.send(
                '絵文字とロールの数が一致しません。最初からやり直してください。'
              );
              step = 0; // リセット
              config = {};
              await privateChannel.send('Botがメッセージを出力するチャンネル名を入力してください');
              return;
            }

            await privateChannel.send('コマンドを実行します…');

            const embed = new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle('リアクションロール')
              .setDescription(config.messageContent);

            const sentMessage = await config.targetChannel.send({ embeds: [embed] });
            const messageId = sentMessage.id;

            if (!reactionRoles.has(messageId)) {
              reactionRoles.set(messageId, new Map());
            }
            const emojiMap = reactionRoles.get(messageId);

            for (let i = 0; i < config.emojis.length; i++) {
              const emoji = config.emojis[i];
              const roleName = config.roleNames[i];

              const role = guild.roles.cache.find((r) => r.name === roleName);
              if (!role) {
                await privateChannel.send(
                  `ロール「${roleName}」が見つかりません。このロールはスキップします。`
                );
                continue;
              }

              emojiMap.set(getEmojiIdentifier(emoji), role.id);
              await sentMessage.react(getEmojiIdentifier(emoji)).catch(console.error);
            }

            await saveReactionRoles();
            await privateChannel.send(
              'コマンドの実行に成功しました。このチャンネルは5秒後に削除されます。'
            );
            setupComplete = true;
            collector.stop();
            break;
        }
      } catch (error) {
        console.error('[リアクションロール] 対話形式設定中にエラーが発生しました:', error);
        await privateChannel.send(
          'エラーが発生しました。設定を中止します。このチャンネルは5秒後に削除されます。'
        );
        setupComplete = true;
        collector.stop();
      }
    });

    collector.on('end', () => {
      if (!setupComplete) {
        privateChannel
          .send('設定がタイムアウトしました。このチャンネルは5秒後に削除されます。')
          .catch(console.error);
      }
      setTimeout(() => privateChannel.delete().catch(console.error), 5000);
    });
  },
};
