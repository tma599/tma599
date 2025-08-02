const fsp = require('fs/promises');
const path = require('path');
const { PermissionsBitField, ChannelType } = require('discord.js');

// ユーザーごとのバックアップディレクトリを取得
const getBackupDir = (userId) => {
  return path.join(__dirname, '..', 'backups', userId);
};

// バックアップディレクトリの存在確認、なければ作成
const ensureBackupDir = async (userId) => {
  const backupDir = getBackupDir(userId);
  try {
    await fsp.mkdir(backupDir, { recursive: true });
  } catch (error) {
    console.error(
      `[エラー] ユーザーID ${userId} のバックアップディレクトリ作成に失敗しました。`,
      error
    );
    throw new Error('バックアップディレクトリの作成に失敗しました。');
  }
};

async function executeBackup(guild, userId, backupName, isAuto = false) {
  let sanitizedName;
  if (isAuto) {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const hh = now.getHours().toString().padStart(2, '0');
    const mi = now.getMinutes().toString().padStart(2, '0');
    sanitizedName = `auto_${yy}${mm}${dd}_${hh}${mi}`;
  } else {
    if (!backupName) throw new Error('バックアップ名が指定されていません。');
    sanitizedName = backupName.replace(/[^a-zA-Z0-9_\-]+/g, '');
    if (!sanitizedName) {
      throw new Error(
        '無効なバックアップ名です。英数字、アンダースコア(_)、ハイフン(-)のみ使用できます。'
      );
    }
  }

  await ensureBackupDir(userId);
  const backupFileName = `${sanitizedName}.json`;
  const backupFilePath = path.join(getBackupDir(userId), backupFileName);

  const backupData = {
    serverName: guild.name,
    serverId: guild.id,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    locked: isAuto ? true : false, // 自動バックアップはデフォルトでロック
    roles: [],
    channels: [],
  };

  await guild.members.fetch();
  console.log('[バックアップ] ロール情報を収集しています...');
  guild.roles.cache
    .filter((role) => role.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .forEach((role) => {
      backupData.roles.push({
        name: role.name,
        color: role.hexColor,
        permissions: role.permissions.toString(),
        hoist: role.hoist,
        mentionable: role.mentionable,
        position: role.position,
        members: role.members.map((member) => member.id),
      });
    });
  console.log('[バックアップ] ロール情報の収集が完了しました。');

  console.log('[バックアップ] チャンネル情報とメッセージ履歴を収集しています...');
  const channelPromises = guild.channels.cache
    .sort((a, b) => a.position - b.position)
    .map(async (channel) => {
      const channelData = {
        name: channel.name,
        type: channel.type,
        parent: channel.parent ? channel.parent.name : null,
        position: channel.position,
        messages: [],
      };

      if (channel.isTextBased() && channel.type !== ChannelType.GuildVoice) {
        try {
          if (
            guild.members.me.permissionsIn(channel).has(PermissionsBitField.Flags.ViewChannel) &&
            guild.members.me
              .permissionsIn(channel)
              .has(PermissionsBitField.Flags.ReadMessageHistory)
          ) {
            const messages = await channel.messages.fetch({ limit: 30 });
            channelData.messages = messages
              .map((msg) => ({
                author: {
                  username: msg.author.username,
                  avatarURL: msg.author.displayAvatarURL(),
                },
                content: msg.content,
                embeds: msg.embeds,
                attachments: msg.attachments.map((a) => a.url),
                timestamp: msg.createdAt.toISOString(),
              }))
              .reverse();
          } else {
            console.log(
              `[バックアップ] チャンネル "${channel.name}" の閲覧またはメッセージ履歴の権限がありません。スキップします。`
            );
          }
        } catch (err) {
          console.error(
            `[エラー] チャンネル "${channel.name}" のメッセージ履歴の取得に失敗しました。`,
            err.message
          );
        }
      }
      return channelData;
    });

  backupData.channels = await Promise.all(channelPromises);
  console.log('[バックアップ] チャンネル情報とメッセージ履歴の収集が完了しました。');

  await fsp.writeFile(backupFilePath, JSON.stringify(backupData, null, 2));

  if (isAuto) {
    const backupDir = getBackupDir(userId);
    const allFiles = await fsp.readdir(backupDir);
    const autoBackups = allFiles
      .filter((file) => file.startsWith('auto_') && file.endsWith('.json'))
      .sort()
      .reverse();

    if (autoBackups.length > 3) {
      const filesToDelete = autoBackups.slice(3);
      for (const fileToDelete of filesToDelete) {
        try {
          await fsp.unlink(path.join(backupDir, fileToDelete));
          console.log(
            `[自動バックアップ] 古いバックアップファイル ${fileToDelete} を削除しました。`
          );
        } catch (err) {
          console.error(
            `[エラー] 古いバックアップファイル ${fileToDelete} の削除に失敗しました。`,
            err
          );
        }
      }
    }
  }

  return backupFileName;
}

module.exports = {
  getBackupDir,
  ensureBackupDir,
  executeBackup,
};
