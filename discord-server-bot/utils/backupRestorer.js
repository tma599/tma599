const { ChannelType, EmbedBuilder } = require('discord.js');

async function applyBackup(guild, backupData, isTemplate = false) {
  console.log(`[復元] サーバー "${guild.name}" (ID: ${guild.id}) の復元処理を開始します。`);
  const createdRoles = new Map();

  console.log('[復元] ロールの復元を開始します。');
  for (const roleData of backupData.roles.reverse()) {
    try {
      const existingRole = guild.roles.cache.find((r) => r.name === roleData.name);
      let newRole;
      if (!existingRole) {
        console.log(`[復元] ロール "${roleData.name}" を作成します。`);
        newRole = await guild.roles.create({
          name: roleData.name,
          color: roleData.color,
          permissions: BigInt(roleData.permissions),
          hoist: roleData.hoist,
          mentionable: roleData.mentionable,
          position: roleData.position,
        });
      } else {
        console.log(`[復元] 既存のロール "${roleData.name}" を更新します。`);
        await existingRole.edit({
          color: roleData.color,
          permissions: BigInt(roleData.permissions),
          hoist: roleData.hoist,
          mentionable: roleData.mentionable,
        });
        newRole = existingRole;
      }
      createdRoles.set(roleData.name, newRole);

      if (!isTemplate && roleData.members && roleData.members.length > 0) {
        console.log(`[復元] ロール "${roleData.name}" のメンバーを復元します。`);
        for (const memberId of roleData.members) {
          try {
            const member = await guild.members.fetch(memberId);
            if (member) {
              try {
                await member.roles.add(newRole);
              } catch (err) {
                console.error(
                  `[エラー] ユーザー "${member.user.tag}" へのロール "${newRole.name}" の付与に失敗しました。Botのロールが対象ロールより下にある可能性があります。`,
                  err.message
                );
              }
            }
          } catch (err) {
            if (err.code !== 10007) {
              console.error(
                `[エラー] メンバー (ID: ${memberId}) の取得に失敗しました。`,
                err.message
              );
            }
          }
        }
      }
    } catch (err) {
      console.error(
        `[エラー] ロール "${roleData.name}" の作成または編集に失敗しました。Botのロールが対象ロールより下にある可能性があります。`,
        err.message
      );
    }
  }
  console.log('[復元] ロールの復元が完了しました。');

  console.log('[復元] チャンネルの復元を開始します。');
  const createdChannels = new Map();
  const threadChannelTypes = [
    ChannelType.GuildPublicThread,
    ChannelType.GuildPrivateThread,
    ChannelType.GuildNewsThread,
  ];
  const regularChannelsData = backupData.channels.filter(
    (c) => !threadChannelTypes.includes(c.type)
  );
  const threadChannelsData = backupData.channels.filter((c) => threadChannelTypes.includes(c.type));

  for (const channelData of regularChannelsData.filter(
    (c) => c.type === ChannelType.GuildCategory
  )) {
    try {
      const existingChannel = guild.channels.cache.find(
        (c) => c.name === channelData.name && c.type === channelData.type
      );
      if (!existingChannel) {
        console.log(`[復元] カテゴリ "${channelData.name}" を作成します。`);
        const newChannel = await guild.channels.create({
          name: channelData.name,
          type: channelData.type,
          position: channelData.position,
        });
        createdChannels.set(channelData.name, newChannel);
      } else {
        console.log(`[復元] 既存のカテゴリ "${channelData.name}" を使用します。`);
        createdChannels.set(channelData.name, existingChannel);
      }
    } catch (err) {
      console.error(`[エラー] カテゴリ "${channelData.name}" の作成に失敗しました。`, err.message);
    }
  }

  for (const channelData of regularChannelsData.filter(
    (c) => c.type !== ChannelType.GuildCategory
  )) {
    try {
      let existingChannel = guild.channels.cache.find(
        (c) => c.name === channelData.name && c.type === channelData.type
      );
      let newChannel = existingChannel;

      if (!existingChannel) {
        const parent = channelData.parent
          ? createdChannels.get(channelData.parent) ||
            guild.channels.cache.find(
              (c) => c.name === channelData.parent && c.type === ChannelType.GuildCategory
            )
          : null;
        console.log(
          `[復元] チャンネル "${channelData.name}" を作成します。${parent ? `(親カテゴリ: ${parent.name})` : ''}`
        );
        newChannel = await guild.channels.create({
          name: channelData.name,
          type: channelData.type,
          parent: parent ? parent.id : null,
          position: channelData.position,
        });
        createdChannels.set(channelData.name, newChannel);
      } else {
        console.log(`[復元] 既存のチャンネル "${channelData.name}" を使用します。`);
        createdChannels.set(channelData.name, existingChannel);
      }

      if (
        newChannel &&
        newChannel.isTextBased() &&
        channelData.messages &&
        channelData.messages.length > 0
      ) {
        console.log(
          `[復元] チャンネル "${newChannel.name}" に ${channelData.messages.length} 件のメッセージを復元します。`
        );
        for (const msg of channelData.messages) {
          try {
            const messageEmbed = new EmbedBuilder()
              .setAuthor({
                name: msg.author.username,
                iconURL: msg.author.avatarURL,
              })
              .setDescription(msg.content || null)
              .setTimestamp(new Date(msg.timestamp));

            if (msg.embeds && msg.embeds.length > 0) {
              messageEmbed.addFields({
                name: '元の埋め込み',
                value: '復元されたメッセージには、元の埋め込みコンテンツも含まれていました。',
              });
            }

            if (msg.attachments && msg.attachments.length > 0) {
              messageEmbed.addFields({ name: '添付ファイル', value: msg.attachments.join('\n') });
            }

            await newChannel.send({ embeds: [messageEmbed] });
          } catch (err) {
            console.error(
              `[エラー] メッセージの復元中にエラーが発生しました (チャンネル: ${newChannel.name})`,
              err.message
            );
          }
        }
      }
    } catch (err) {
      console.error(
        `[エラー] チャンネル "${channelData.name}" の作成またはメッセージ復元に失敗しました。`,
        err.message
      );
    }
  }

  for (const threadData of threadChannelsData) {
    try {
      const parentChannel =
        createdChannels.get(threadData.parent) ||
        guild.channels.cache.find((c) => c.name === threadData.parent && c.isTextBased());
      if (parentChannel && parentChannel.threads) {
        const existingThread = parentChannel.threads.cache.find((t) => t.name === threadData.name);
        if (!existingThread) {
          console.log(
            `[復元] スレッド "${threadData.name}" をチャンネル "${parentChannel.name}" に作成します。`
          );
          await parentChannel.threads.create({
            name: threadData.name,
            type: threadData.type,
            autoArchiveDuration: 1440,
          });
        } else {
          console.log(`[復元] 既存のスレッド "${threadData.name}" を使用します。`);
        }
      } else {
        console.error(
          `[エラー] スレッド "${threadData.name}" の親チャンネル "${threadData.parent}" が見つかりません。`
        );
      }
    } catch (err) {
      console.error(`[エラー] スレッド "${threadData.name}" の作成に失敗しました。`, err.message);
    }
  }
  console.log(`チャンネルの復元が完了しました。`);
  console.log(`[復元] サーバー "${guild.name}" (ID: ${guild.id}) の復元処理が完了しました。`);
}

module.exports = { applyBackup };
