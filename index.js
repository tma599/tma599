require('dotenv').config();
const fsp = require('fs/promises');
const path = require('path');
const cron = require('node-cron');
const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  Collection,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
} = require('discord.js');
const { loadCommands } = require('./utils/commandLoader');
const { getBackupDir, executeBackup } = require('./utils/backupManager');
const { backupSchedules, saveSchedules, loadSchedules } = require('./models/backupSchedules');
const { reactionRoles, loadReactionRoles } = require('./models/reactionRoles');

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMessageReactions,
].filter(Boolean);

const client = new Client({
  intents: intents,
});

client.commands = new Collection();

const schedulesFilePath = path.join(__dirname, 'schedules.json');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const USE_GLOBAL = false;

// --- Event Handlers ---
client.once(Events.ClientReady, async () => {
  console.log('--------------------------------------------------');
  console.log(`[起動] ${client.user.tag} が起動しました。`);
  console.log('[起動] スラッシュコマンドを登録します。');
  try {
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
    await loadSchedules(client); // clientを渡す
    await loadReactionRoles();
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('[エラー] スラッシュコマンドの登録に失敗しました。', err);
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKENが設定されていません。');
  process.exit(1);
}

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
  if (newMessage.author.bot || newMessage.system || oldMessage.content === newMessage.content) {
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

client.login(process.env.DISCORD_TOKEN);
