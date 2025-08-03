const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  Collection,
  MessageFlags,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const { loadCommands } = require('../utils/commandLoader');
const { initializeNgWords, ngWords, normalizeJapanese } = require('../models/ngwords');
const { reactionRoles, loadReactionRoles, saveReactionRoles } = require('../models/reactionRoles');
const { loadSchedules } = require('../models/backupSchedules');

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildVoiceStates, // Add this intent
].filter(Boolean);

const client = new Client({ intents });

client.commands = new Collection();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const USE_GLOBAL = false;

function getEmojiIdentifier(emoji) {
  const customEmojiRegex = /<a?:\w+:(\d+)>/;
  const match = emoji.match(customEmojiRegex);
  if (match) {
    return match[1];
  }
  return emoji;
}

client.once(Events.ClientReady, async () => {
  console.log('--------------------------------------------------');
  console.log(`[起動] ${client.user.tag} が起動しました。`);
  console.log('[起動] 各種モジュールを初期化します。');
  try {
    await initializeNgWords();
    await loadSchedules(client);
    await loadReactionRoles();

    console.log('[起動] スラッシュコマンドを登録します。');
    await loadCommands(client);
    const commandsToRegister = Array.from(client.commands.values()).map((cmd) => cmd.data.toJSON());

    if (USE_GLOBAL) {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandsToRegister,
      });
      console.log('[起動] グローバルスラッシュコマンドを登録しました。');
    } else {
      for (const guild of client.guilds.cache.values()) {
        await guild.commands.set(commandsToRegister);
        console.log(`[起動] ギルド "${guild.name}" にスラッシュコマンドを登録しました。`);
      }
    }
    console.log('[起動] スラッシュコマンドの登録が完了しました。');
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('[エラー] 起動処理中にエラーが発生しました。', err);
  }
});

client.on(Events.GuildCreate, async (guild) => {
  if (USE_GLOBAL) return;
  try {
    const commandsToRegister = Array.from(client.commands.values()).map((cmd) => cmd.data.toJSON());
    await guild.commands.set(commandsToRegister);
    console.log(`[参加] 新しいギルド "${guild.name}" に参加し、コマンドを登録しました。`);
  } catch (err) {
    console.error(`[エラー] 新しいギルド "${guild.name}" でのコマンド登録に失敗しました。`, err);
  }
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (newMessage.author.bot || newMessage.system) return;

  const guildId = newMessage.guild.id;
  const guildNgWords = ngWords.get(guildId) || [];

  if (guildNgWords.length > 0) {
    const normalizedContent = await normalizeJapanese(newMessage.content);
    for (const ngWord of guildNgWords) {
      if (normalizedContent.includes(ngWord.normalized)) {
        try {
          await newMessage.delete();
          const sentMsg = await newMessage.channel.send(
            `${newMessage.author}, あなたのメッセージにはNGワードが含まれていたため、削除されました。`
          );
          setTimeout(() => sentMsg.delete().catch(console.error), 5000);
          console.log(
            `[NGワード] ユーザー ${newMessage.author.tag} の編集後メッセージを削除しました。理由: NGワード「${ngWord.original}」を検出。`
          );
        } catch (error) {
          console.error('[NGワード] 編集後メッセージの削除中にエラーが発生しました:', error);
        }
        return;
      }
    }
  }

  if (oldMessage.content === newMessage.content) {
    return;
  }
  if (oldMessage.partial) {
    try {
      oldMessage = await oldMessage.fetch();
    } catch (error) {
      console.error(
        `[エラー] 編集前のメッセージの取得に失敗しました (ID: ${oldMessage.id})`,
        error
      );
      return;
    }
  }
  const userTag = newMessage.author.tag;
  const userId = newMessage.author.id;
  const channelName = newMessage.channel.name;
  const oldContent = oldMessage.content || '[内容なし]';
  const newContent = newMessage.content || '[内容なし]';
  const messageURL = `https://discord.com/channels/${newMessage.guildId}/${newMessage.channelId}/${newMessage.id}`;
  console.log('--------------------------------------------------');
  console.log('[メッセージ編集検知]');
  console.log(`ユーザー: ${userTag} (ID: ${userId})`);
  console.log(`チャンネル: #${channelName}`);
  console.log(`編集前の内容: ${oldContent}`);
  console.log(`編集後の内容: ${newContent}`);
  console.log(`メッセージURL: ${messageURL}`);
  console.log('--------------------------------------------------');
});

client.on(Events.MessageDelete, async (message) => {
  if (message.partial) {
    console.log('[メッセージ削除検知] キャッシュ外のメッセージが削除されました。');
    return;
  }
  const userTag = message.author ? message.author.tag : '不明なユーザー';
  const userId = message.author ? message.author.id : '不明なID';
  const channelName = message.channel ? message.channel.name : '不明なチャンネル';
  const channelId = message.channel ? message.channel.id : '不明なID';
  const deletedContent = message.content || '[内容なし]';
  const messageId = message.id;
  const messageURL = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
  let attachmentURLs = [];
  if (message.attachments.size > 0) {
    attachmentURLs = message.attachments.map((attachment) => attachment.url);
  }
  console.log('--------------------------------------------------');
  console.log('[メッセージ削除検知]');
  console.log(`送信者: ${userTag} (ID: ${userId})`);
  console.log(`チャンネル: #${channelName} (ID: ${channelId})`);
  console.log(`削除されたメッセージ内容: ${deletedContent}`);
  if (attachmentURLs.length > 0) {
    console.log(`添付ファイルURL: ${attachmentURLs.join(', ')}`);
  }
  console.log(`メッセージID: ${messageId}`);
  console.log(`メッセージURL: ${messageURL}`);
  console.log('--------------------------------------------------');
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('[リアクション] リアクションのフェッチ中にエラーが発生しました:', error);
      return;
    }
  }

  const messageId = reaction.message.id;
  const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;

  if (reactionRoles.has(messageId)) {
    const emojiMap = reactionRoles.get(messageId);
    if (emojiMap.has(emojiIdentifier)) {
      const roleId = emojiMap.get(emojiIdentifier);
      const member = reaction.message.guild.members.cache.get(user.id);
      if (member) {
        try {
          const role = reaction.message.guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.add(role);
            console.log(
              `[リアクションロール] ユーザー ${user.tag} にロール ${role.name} を付与しました。`
            );
          } else {
            console.warn(`[リアクションロール] ロールID ${roleId} が見つかりません。`);
          }
        } catch (error) {
          console.error('[リアクションロール] ロールの付与中にエラーが発生しました:', error);
        }
      }
    }
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('[リアクション] リアクションのフェッチ中にエラーが発生しました:', error);
      return;
    }
  }

  const messageId = reaction.message.id;
  const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;

  if (reactionRoles.has(messageId)) {
    const emojiMap = reactionRoles.get(messageId);
    if (emojiMap.has(emojiIdentifier)) {
      const roleId = emojiMap.get(emojiIdentifier);
      const member = reaction.message.guild.members.cache.get(user.id);
      if (member) {
        try {
          const role = reaction.message.guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.remove(role);
            console.log(
              `[リアクションロール] ユーザー ${user.tag} からロール ${role.name} を削除しました。`
            );
          } else {
            console.warn(`[リアクションロール] ロールID ${roleId} が見つかりません。`);
          }
        } catch (error) {
          console.error('[リアクションロール] ロールの削除中にエラーが発生しました:', error);
        }
      }
    }
  }
});

const reactionRoleSetup = new Map();

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const guildNgWords = ngWords.get(guildId) || [];

  if (guildNgWords.length > 0) {
    const normalizedContent = await normalizeJapanese(message.content);
    for (const ngWord of guildNgWords) {
      if (normalizedContent.includes(ngWord.normalized)) {
        try {
          await message.delete();
          const sentMsg = await message.channel.send(
            `${message.author}, あなたのメッセージにはNGワードが含まれていたため、削除されました。`
          );
          setTimeout(() => sentMsg.delete().catch(console.error), 5000);
          console.log(
            `[NGワード] ユーザー ${message.author.tag} のメッセージを削除しました。理由: NGワード「${ngWord.original}」を検出。`
          );
        } catch (error) {
          console.error('[NGワード] メッセージの削除中にエラーが発生しました:', error);
        }
        return;
      }
    }
  }

  if (
    message.channel.name.startsWith('rr-config-') &&
    message.channel.name.endsWith(message.author.id)
  ) {
    const configUserId = message.author.id;
    const setup = reactionRoleSetup.get(configUserId);
    let setupComplete = false;

    try {
      if (!setup) {
        const targetChannel = message.guild.channels.cache.find((c) => c.name === message.content);
        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
          return message.reply('**有効なテキストチャンネル名を指定してください。**');
        }
        reactionRoleSetup.set(configUserId, { step: 1, channel: targetChannel });
        return message.reply('Botがメッセージを出力するチャンネル名を入力してください。');
      }

      switch (setup.step) {
        case 1:
          setup.message = message.content;
          setup.step = 2;
          return message.reply(
            '**追加する絵文字を入力してください(複数個やる場合は半角スペースを挟んでください)**'
          );
        case 2:
          setup.emojis = message.content.split(' ');
          setup.step = 3;
          return message.reply(
            '**リアクションに結びつけるロール名を入力してください(絵文字との結びつけは左から順に、半角スペースで区切ってください)**'
          );
        case 3:
          setup.roles = message.content.split(' ');
          if (setup.emojis.length !== setup.roles.length) {
            await message.reply(
              '**絵文字とロールの数が一致しません。最初からやり直してください。このチャンネルは5秒後に削除されます。**'
            );
            setupComplete = true;
            return;
          }

          await message.reply('**入力された設定でコマンドを実行します…**');

          const targetChannel = setup.channel;

          const embedMessage = new EmbedBuilder().setColor(0x0099ff).setDescription(setup.message);

          const sentMessage = await targetChannel.send({ embeds: [embedMessage] });
          const messageId = sentMessage.id;

          if (!reactionRoles.has(messageId)) {
            reactionRoles.set(messageId, new Map());
          }
          const emojiMap = reactionRoles.get(messageId);

          for (let i = 0; i < setup.emojis.length; i++) {
            const emoji = setup.emojis[i];
            const roleName = setup.roles[i];
            const role = message.guild.roles.cache.find((r) => r.name === roleName);

            if (!role) {
              await message.reply(
                `**ロール「${roleName}」が見つかりません。このロールはスキップします。**`
              );
              continue;
            }

            const emojiIdentifier = getEmojiIdentifier(emoji);
            emojiMap.set(emojiIdentifier, role.id);
            await sentMessage.react(emoji).catch((err) => {
              console.error(`Failed to react with ${emoji}:`, err);
              message.channel.send(
                `**絵文字 ${emoji} のリアクションに失敗しました。ボットがこの絵文字にアクセスできない可能性があります。**`
              );
            });
          }

          await saveReactionRoles();
          await message.reply('**実行されました。このチャンネルは5秒後に削除されます。**');
          setupComplete = true;
          break;
      }
    } catch (error) {
      console.error('リアクションロールの設定中にエラーが発生しました:', error);
      await message
        .reply('**エラーが発生したため、設定を中止します。このチャンネルは5秒後に削除されます。**')
        .catch(console.error);
      setupComplete = true;
    } finally {
      if (setupComplete) {
        reactionRoleSetup.delete(configUserId);
        setTimeout(() => message.channel.delete().catch(console.error), 5000);
      }
    }
  }
});

function logCommand(interaction) {
  const user = interaction.user;
  const commandName = interaction.commandName;
  const options = interaction.options.data.map((opt) => `${opt.name}: ${opt.value}`).join(' ');
  const guild = interaction.guild;
  console.log(
    `[コマンド実行] ユーザー: ${user.tag} (ID: ${user.id}) | コマンド: /${commandName} ${options} | サーバー: ${guild.name} (ID: ${guild.id})`
  );
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error('[エラー] オートコンプリートの処理中にエラーが発生しました。', error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild || !interaction.inCachedGuild()) {
    return interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      flags: MessageFlags.Ephemeral,
    });
  }

  logCommand(interaction);
  const { commandName } = interaction;

  try {
    const command = client.commands.get(commandName);
    if (command) {
      await command.execute(interaction);
    } else {
      console.error(`[エラー] 未知のコマンドが実行されました: ${commandName}`);
      await interaction.reply({ content: '不明なコマンドです。', flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error('[エラー] コマンド実行中に予期せぬエラーが発生しました。', error);
    const replyOptions = {
      content: 'コマンドの実行中に予期せぬエラーが発生しました。',
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyOptions);
    } else {
      await interaction.reply(replyOptions);
    }
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[エラー] 未処理のPromise rejection:', reason);
});

// Voice State Update Event
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const wsServer = require('../ws/server'); // Import here to avoid circular dependency

  // Check if a user joined or left a voice channel
  if (oldState.channelId !== newState.channelId) {
    // User joined a channel
    if (newState.channelId) {
      console.log(
        `[Voice] ${newState.member.user.tag} joined voice channel ${newState.channel.name} in ${newState.guild.name}`
      );
      wsServer.broadcastVoiceStateUpdate(
        newState.guild.id,
        newState.channel.id,
        newState.member.user.id
      );
    }
    // User left a channel
    if (oldState.channelId) {
      console.log(
        `[Voice] ${oldState.member.user.tag} left voice channel ${oldState.channel.name} in ${oldState.guild.name}`
      );
      wsServer.broadcastVoiceStateUpdate(
        oldState.guild.id,
        oldState.channel.id,
        oldState.member.user.id
      );
    }
  }
});

module.exports = client;
