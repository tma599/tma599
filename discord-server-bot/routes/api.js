const express = require('express');
const router = express.Router();
const fsp = require('fs/promises');
const path = require('path');
const cron = require('node-cron');
const { CronExpressionParser } = require('cron-parser');
const { getBackupDir, executeBackup } = require('../utils/backupManager');
const { executeRestore } = require('../utils/backupRestorer');
const { backupSchedules, addSchedule, removeSchedule } = require('../models/backupSchedules');
const { reactionRoles, saveReactionRoles } = require('../models/reactionRoles');
const { ngWords, saveNgWords, normalizeJapanese } = require('../models/ngwords');
const { PermissionsBitField, ChannelType, AuditLogEvent } = require('discord.js');
const { execFile, spawn } = require('child_process');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');

const wsServer = require('../ws/server');

function ensureApiAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please log in again.' });
}

router.use(ensureApiAuth);

// Admin
router.post('/admin/restart', (req, res) => {
  console.log(`[Web] Restart requested by ${req.user.username}`);
  execFile('pm2', ['restart', '0'], (error, stdout, stderr) => {
    if (error) {
      console.error(`[Web] Restart error: ${error}`);
      return res.status(500).json({ error: 'Failed to restart bot.' });
    }
    res.json({ success: true, message: 'Bot is restarting...' });
  });
});

router.post('/admin/reload', (req, res) => {
  console.log(`[Web] Reload requested by ${req.user.username}`);
  execFile('pm2', ['reload', '0'], (error, stdout, stderr) => {
    if (error) {
      console.error(`[Web] Reload error: ${error}`);
      return res.status(500).json({ error: 'Failed to reload bot.' });
    }
    res.json({ success: true, message: 'Bot is reloading...' });
  });
});

// Backups
router.get('/backups', async (req, res) => {
  const backupsPath = path.join(__dirname, '../backups');
  const targetGuildId = req.query.guildId;
  const backupType = req.query.type;

  try {
    const userFolders = await fsp.readdir(backupsPath, { withFileTypes: true });
    const allBackups = [];

    for (const userFolder of userFolders) {
      if (userFolder.isDirectory()) {
        const userId = userFolder.name;
        const userBackupDir = getBackupDir(userId);
        try {
          const files = await fsp.readdir(userBackupDir);
          let backupFiles = files.filter((file) => file.endsWith('.json'));

          if (backupType === 'auto') {
            backupFiles = backupFiles.filter((file) => file.startsWith('auto_'));
          } else if (backupType === 'manual') {
            backupFiles = backupFiles.filter((file) => !file.startsWith('auto_'));
          }

          for (const file of backupFiles) {
            const filePath = path.join(userBackupDir, file);
            const data = await fsp.readFile(filePath, 'utf-8');
            const json = JSON.parse(data);

            if (targetGuildId && json.serverId !== targetGuildId) {
              continue;
            }

            allBackups.push({
              userId: userId,
              fileName: file,
              serverName: json.serverName || 'N/A',
              createdAt: json.createdAt || 'N/A',
              locked: json.locked || false,
              guildId: json.serverId || 'N/A',
            });
          }
        } catch (err) {
          console.error(`[Web] Could not read backups for user ${userId}:`, err);
        }
      }
    }
    res.json(allBackups);
  } catch (error) {
    console.error('[Web] Error fetching backups:', error);
    if (error.code === 'ENOENT') {
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to retrieve backups.' });
  }
});

router.post('/backups/action', async (req, res) => {
  const { action, userId, fileName } = req.body;

  if (!action || !userId || !fileName) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  const backupDir = getBackupDir(userId);
  const backupFilePath = path.join(backupDir, fileName);

  try {
    await fsp.access(backupFilePath);
    const fileData = await fsp.readFile(backupFilePath, 'utf-8');
    const backupJson = JSON.parse(fileData);

    switch (action) {
      case 'lock':
        backupJson.locked = true;
        await fsp.writeFile(backupFilePath, JSON.stringify(backupJson, null, 2));
        console.log(`[Web] User ${req.user.username} locked backup ${fileName}`);
        res.json({ success: true, message: `File ${fileName} locked.` });
        break;
      case 'unlock':
        backupJson.locked = false;
        await fsp.writeFile(backupFilePath, JSON.stringify(backupJson, null, 2));
        console.log(`[Web] User ${req.user.username} unlocked backup ${fileName}`);
        res.json({ success: true, message: `File ${fileName} unlocked.` });
        break;
      case 'delete':
        if (backupJson.locked) {
          return res.status(403).json({ error: 'Cannot delete a locked file.' });
        }
        await fsp.unlink(backupFilePath);
        console.log(`[Web] User ${req.user.username} deleted backup ${fileName}`);
        res.json({ success: true, message: `File ${fileName} deleted.` });
        break;
      default:
        res.status(400).json({ error: 'Invalid action.' });
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: `File ${fileName} not found.` });
    }
    console.error(`[Web] Error performing action ${action} on ${fileName}:`, error);
    res.status(500).json({ error: `Failed to perform action on ${fileName}.` });
  }
});

// Guilds
router.get('/guilds', (req, res) => {
  try {
    const guilds = req.client.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      iconURL: guild.iconURL(),
      memberCount: guild.memberCount,
    }));
    res.json(guilds);
  } catch (error) {
    console.error('[Web] Error fetching guilds:', error);
    res.status(500).json({ error: 'Failed to retrieve guilds.' });
  }
});

router.get('/guilds/:guildId', (req, res) => {
  try {
    const guildId = req.params.guildId;
    const guild = req.client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found or bot is not in this guild.' });
    }

    const channels = guild.channels.cache.map((channel) => {
      const everyoneRole = guild.roles.everyone;
      const perms = channel.permissionsFor(everyoneRole);
      const isPrivate = !perms.has(PermissionsBitField.Flags.ViewChannel);

      // Get voice channel members if it's a voice channel
      let voiceMembers = [];
      if (channel.type === ChannelType.GuildVoice) {
        voiceMembers = channel.members.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          avatarURL: member.user.displayAvatarURL(),
        }));
      }

      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        isPrivate: isPrivate,
        parentId: channel.parentId,
        position: channel.position,
        voiceMembers: voiceMembers, // Add voice members here
      };
    });

    const roles = guild.roles.cache.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.hexColor,
      position: role.position,
    }));

    const members = guild.memberCount;

    res.json({
      id: guild.id,
      name: guild.name,
      iconURL: guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png',
      memberCount: members,
      channels: channels,
      roles: roles,
    });
  } catch (error) {
    console.error('[Web] Error fetching guild details:', error);
    res.status(500).json({ error: 'Failed to retrieve guild details.' });
  }
});

// Roles
router.get('/guilds/:guildId/roles', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const roles = guild.roles.cache
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        permissions: role.permissions.toArray(),
        memberCount: role.members.size,
      }))
      .sort((a, b) => b.position - a.position);

    res.json(roles);
  } catch (error) {
    console.error(`[Web] Error fetching roles for guild ${req.params.guildId}:`, error);
    res.status(500).json({ error: 'Failed to fetch roles.' });
  }
});

router.post('/guilds/:guildId/roles', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { name, color, permissions } = req.body;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const newRole = await guild.roles.create({
      name,
      color,
      permissions: new PermissionsBitField(permissions),
    });

    res.status(201).json(newRole);
  } catch (error) {
    console.error(`[Web] Error creating role in guild ${req.params.guildId}:`, error);
    res.status(500).json({ error: 'Failed to create role.' });
  }
});

router.patch('/guilds/:guildId/roles/:roleId', async (req, res) => {
  try {
    const { guildId, roleId } = req.params;
    const { name, color, permissions } = req.body;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const role = guild.roles.cache.get(roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const updatedRole = await role.edit({
      name,
      color,
      permissions: new PermissionsBitField(permissions),
    });

    res.json(updatedRole);
  } catch (error) {
    console.error(`[Web] Error updating role ${req.params.roleId}:`, error);
    res.status(500).json({ error: 'Failed to update role.' });
  }
});

router.delete('/guilds/:guildId/roles/:roleId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const role = guild.roles.cache.get(roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });

    await role.delete();
    res.status(204).send();
  } catch (error) {
    console.error(`[Web] Error deleting role ${req.params.roleId}:`, error);
    res.status(500).json({ error: 'Failed to delete role.' });
  }
});

router.post('/guilds/:guildId/roles/positions', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { roles } = req.body; // Expects an array of role IDs in the new order
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const rolePositions = roles.map((roleId, index) => ({
      role: roleId,
      position: roles.length - index,
    }));

    await guild.roles.setPositions(rolePositions);
    res.json({ success: true, message: 'Role positions updated.' });
  } catch (error) {
    console.error(`[Web] Error updating role positions for guild ${req.params.guildId}:`, error);
    res.status(500).json({ error: 'Failed to update role positions.' });
  }
});

// Reaction Roles
router.post('/guilds/:guildId/reaction-roles', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channelId, messageContent, emojis, roleIds } = req.body;

    if (!channelId || !messageContent || !emojis || !roleIds || emojis.length !== roleIds.length) {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found.' });
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return res.status(404).json({ error: 'Text channel not found.' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('リアクションロール')
      .setDescription(messageContent);

    const sentMessage = await channel.send({ embeds: [embed] });
    const messageId = sentMessage.id;

    if (!reactionRoles.has(messageId)) {
      reactionRoles.set(messageId, new Map());
    }
    const emojiMap = reactionRoles.get(messageId);

    for (let i = 0; i < emojis.length; i++) {
      const emojiIdentifier = getEmojiIdentifier(emojis[i]);
      const roleId = roleIds[i];
      const role = guild.roles.cache.get(roleId);

      if (!role) {
        console.warn(`[Web] Role with ID ${roleId} not found in guild ${guildId}.`);
        continue;
      }

      emojiMap.set(emojiIdentifier, role.id);
      await sentMessage.react(emojiIdentifier).catch(console.error);
    }

    await saveReactionRoles();
    res.status(201).json({ success: true, messageId: messageId });
  } catch (error) {
    console.error('[Web] Error creating reaction role:', error);
    res.status(500).json({ error: 'Failed to create reaction role.' });
  }
});

// NG Words
router.get('/guilds/:guildId/ngwords', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guildNgWords = ngWords.get(guildId) || [];
    res.json(guildNgWords.map((w) => w.original));
  } catch (error) {
    console.error('[Web] Error fetching NG words:', error);
    res.status(500).json({ error: 'Failed to retrieve NG words.' });
  }
});

router.post('/guilds/:guildId/ngwords', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { word } = req.body;

    if (!word || word.trim() === '') {
      return res
        .status(400)
        .json({ error: 'NGワードが指定されていないか、空です。', field: 'word' });
    }

    const originalWord = word.trim();
    const normalizedWord = await normalizeJapanese(originalWord);
    let currentNgWords = ngWords.get(guildId) || [];

    if (currentNgWords.some((w) => w.normalized === normalizedWord)) {
      return res.status(409).json({ error: `NGワード「${originalWord}」は既に登録されています。` });
    }

    currentNgWords.push({ original: originalWord, normalized: normalizedWord });
    ngWords.set(guildId, currentNgWords);
    await saveNgWords();

    res.status(201).json({
      success: true,
      message: `NGワード「${originalWord}」を追加しました。`,
      addedWord: originalWord,
    });
  } catch (error) {
    console.error('[Web] Error adding NG word:', error);
    res.status(500).json({ error: 'NGワードの追加に失敗しました。' });
  }
});

router.delete('/guilds/:guildId/ngwords/:word', async (req, res) => {
  try {
    const { guildId, word } = req.params;
    const originalWordToDelete = decodeURIComponent(word);

    let currentNgWords = ngWords.get(guildId) || [];

    const initialLength = currentNgWords.length;
    currentNgWords = currentNgWords.filter((w) => w.original !== originalWordToDelete);

    if (currentNgWords.length === initialLength) {
      return res
        .status(404)
        .json({ error: `NGワード「${originalWordToDelete}」が見つかりませんでした。` });
    }

    ngWords.set(guildId, currentNgWords);
    await saveNgWords();

    res.json({ success: true, message: `NGワード「${originalWordToDelete}」を削除しました。` });
  } catch (error) {
    console.error('[Web] Error deleting NG word:', error);
    res.status(500).json({ error: 'NGワードの削除に失敗しました。' });
  }
});

// Delete Messages
router.post('/guilds/:guildId/deletemessage', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channelId, userIdentifier, count } = req.body;

    if (!channelId || !count) {
      return res.status(400).json({ error: 'チャンネルIDと削除件数は必須です。' });
    }

    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found.' });
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return res.status(404).json({ error: 'Text channel not found.' });
    }

    let targetUser = null;
    if (userIdentifier) {
      targetUser = guild.members.cache.get(userIdentifier);
      if (!targetUser) {
        targetUser = guild.members.cache.find((member) =>
          member.user.username.toLowerCase().includes(userIdentifier.toLowerCase())
        );
      }
      if (!targetUser) {
        return res
          .status(404)
          .json({ error: `ユーザー「${userIdentifier}」が見つかりませんでした。` });
      }
    }

    const messages = await channel.messages.fetch({ limit: count });
    let filteredMessages = messages;
    if (targetUser) {
      filteredMessages = messages.filter((m) => m.author.id === targetUser.id);
    }

    const deletedMessages = await channel.bulkDelete(filteredMessages, true);

    console.log(
      `[Web] ${req.user.username} deleted ${deletedMessages.size} messages from #${channel.name} in ${guild.name}`
    );
    res.json({ success: true, message: `${deletedMessages.size}件のメッセージを削除しました。` });
  } catch (error) {
    console.error('[Web] Error deleting messages:', error);
    res.status(500).json({ error: 'メッセージの削除に失敗しました。' });
  }
});

// Users
router.get('/guilds/:guildId/users', (req, res) => {
  try {
    const { guildId } = req.params;
    const query = req.query.q ? req.query.q.toLowerCase() : '';

    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found.' });
    }

    guild.members
      .fetch()
      .then((fetchedMembers) => {
        const users = fetchedMembers
          .filter(
            (member) =>
              member.user.username.toLowerCase().includes(query) || member.user.id.includes(query)
          )
          .map((member) => ({
            id: member.user.id,
            username: member.user.username,
            discriminator: member.user.discriminator,
            tag: member.user.tag,
            avatarURL: member.user.displayAvatarURL(),
          }));
        res.json(users);
      })
      .catch((error) => {
        console.error('[Web] Error fetching guild members:', error);
        res.status(500).json({ error: 'メンバーの取得に失敗しました。' });
      });
  } catch (error) {
    console.error('[Web] Error searching users:', error);
    res.status(500).json({ error: 'ユーザー検索に失敗しました。' });
  }
});

// Backup/Restore
router.post('/guilds/:guildId/backups', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { backupName, backupMessages } = req.body;
    const userId = req.user.id;

    if (!backupName) {
      return res.status(400).json({ error: 'Backup name is required.' });
    }

    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found.' });
    }

    await executeBackup({
      guild: guild,
      userId: userId,
      backupName: backupName,
      isAuto: false,
      backupMessages: !!backupMessages,
    });

    res
      .status(201)
      .json({ success: true, message: `バックアップ「${backupName}」の作成を開始しました。` });
  } catch (error) {
    console.error('[Web] Error creating backup:', error);
    res.status(500).json({ error: 'バックアップの作成に失敗しました。' });
  }
});

router.post('/guilds/:guildId/restore', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { fileName } = req.body;
    const userId = req.user.id;

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required.' });
    }

    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found.' });
    }

    const mockInteraction = {
      guild: guild,
      user: { id: userId },
      options: {
        getString: (key) => {
          if (key === 'file_name') return fileName;
          return null;
        },
      },
      reply: async (options) => {
        console.log(`[Web-Restore] Reply: ${options.content}`);
      },
      followUp: async (options) => {
        console.log(`[Web-Restore] FollowUp: ${options.content}`);
      },
      deferReply: async () => {
        console.log('[Web-Restore] Reply deferred.');
      },
    };

    await executeRestore(mockInteraction);

    res.json({ success: true, message: `バックアップ「${fileName}」からの復元を開始しました。` });
  } catch (error) {
    console.error('[Web] Error restoring backup:', error);
    res.status(500).json({ error: `復元に失敗しました: ${error.message}` });
  }
});

// Schedules
router.get('/guilds/:guildId/schedules', (req, res) => {
  const { guildId } = req.params;
  const schedulesForGuild = backupSchedules.get(guildId) || [];
  const serializableSchedules = schedulesForGuild.map((schedule) => ({
    cronTime: schedule.cronTime,
    createdAt: schedule.createdAt,
    nextRun: CronExpressionParser.parse(schedule.cronTime, { tz: 'Asia/Tokyo' })
      .next()
      .toDate()
      .toISOString(),
  }));
  res.json(serializableSchedules);
});

router.post('/guilds/:guildId/schedules', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { cronTime } = req.body;
    const userId = req.user.id;

    if (!cron.validate(cronTime)) {
      return res.status(400).json({ error: 'Invalid cron format.' });
    }

    await addSchedule(req.client, guildId, cronTime, userId);
    res.status(201).json({ success: true, message: `スケジュール「${cronTime}」を追加しました。` });
  } catch (error) {
    console.error('[Web] Error adding schedule:', error);
    res.status(500).json({ error: `スケジュールの追加に失敗しました: ${error.message}` });
  }
});

router.delete('/guilds/:guildId/schedules', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { cronTime } = req.body;

    await removeSchedule(guildId, cronTime);
    res.json({ success: true, message: `スケジュール「${cronTime}」を削除しました。` });
  } catch (error) {
    console.error('[Web] Error deleting schedule:', error);
    res.status(500).json({ error: `スケジュールの削除に失敗しました: ${error.message}` });
  }
});

// Member Management
router.get('/guilds/:guildId/members/:memberId', async (req, res) => {
  try {
    const { guildId, memberId } = req.params;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const member = await guild.members.fetch(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    res.json({
      id: member.id,
      username: member.user.username,
      nickname: member.nickname,
      avatarURL: member.user.displayAvatarURL(),
      roles: member.roles.cache.map((r) => r.id),
    });
  } catch (error) {
    console.error(`[Web] Error fetching member details:`, error);
    res.status(500).json({ error: 'Failed to fetch member details.' });
  }
});

router.patch('/guilds/:guildId/members/:memberId/nickname', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { nickname } = req.body;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const member = await guild.members.fetch(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    await member.setNickname(nickname);
    res.json({ success: true });
  } catch (error) {
    console.error(`[Web] Error updating nickname:`, error);
    res.status(500).json({ error: 'Failed to update nickname.' });
  }
});

router.post('/guilds/:guildId/members/:memberId/roles', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { roleId } = req.body;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const member = await guild.members.fetch(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    await member.roles.add(roleId);
    res.json({ success: true });
  } catch (error) {
    console.error(`[Web] Error adding role to member:`, error);
    res.status(500).json({ error: 'Failed to add role.' });
  }
});

router.delete('/guilds/:guildId/members/:memberId/roles/:roleId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const member = await guild.members.fetch(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    await member.roles.remove(roleId);
    res.json({ success: true });
  } catch (error) {
    console.error(`[Web] Error removing role from member:`, error);
    res.status(500).json({ error: 'Failed to remove role.' });
  }
});

router.post('/guilds/:guildId/members/:memberId/kick', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const member = await guild.members.fetch(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    await member.kick();
    res.json({ success: true });
  } catch (error) {
    console.error(`[Web] Error kicking member:`, error);
    res.status(500).json({ error: 'Failed to kick member.' });
  }
});

router.post('/guilds/:guildId/members/:memberId/ban', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const member = await guild.members.fetch(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    await member.ban();
    res.json({ success: true });
  } catch (error) {
    console.error(`[Web] Error banning member:`, error);
    res.status(500).json({ error: 'Failed to ban member.' });
  }
});

// Channel Management
router.get('/guilds/:guildId/channels/:channelId/messages', async (req, res) => {
  try {
    const { guildId, channelId } = req.params;
    const { before, after, date } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return res.status(404).json({ error: 'Text channel not found' });
    }

    const fetchOptions = { limit, cache: false };
    if (before) fetchOptions.before = before;
    if (after) fetchOptions.after = after;

    if (date && !before && !after) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const timestampToSnowflake = (timestamp) => (BigInt(timestamp) - 1420070400000n) << 22n;
      fetchOptions.after = timestampToSnowflake(startDate.getTime()).toString();
    }

    const messages = await channel.messages.fetch(fetchOptions);
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      author: {
        id: msg.author.id,
        username: msg.author.username,
        avatarURL: msg.author.displayAvatarURL(),
      },
      timestamp: msg.createdAt,
      embeds: msg.embeds.map((embed) => ({
        title: embed.title,
        description: embed.description,
        url: embed.url,
        color: embed.color,
        hexColor: embed.hexColor,
        author: embed.author ? { name: embed.author.name, iconURL: embed.author.iconURL } : null,
        fields: embed.fields.map((field) => ({
          name: field.name,
          value: field.value,
          inline: field.inline,
        })),
        image: embed.image ? { url: embed.image.url } : null,
        thumbnail: embed.thumbnail ? { url: embed.thumbnail.url } : null,
        footer: embed.footer ? { text: embed.footer.text, iconURL: embed.footer.iconURL } : null,
        timestamp: embed.timestamp,
      })),
      attachments: msg.attachments.map((attachment) => ({
        id: attachment.id,
        url: attachment.url,
        proxyURL: attachment.proxyURL,
        filename: attachment.name,
        size: attachment.size,
        contentType: attachment.contentType,
        width: attachment.width,
        height: attachment.height,
      })),
    }));

    // Always return in ascending order (oldest first)
    res.json(formattedMessages.reverse());
  } catch (error) {
    console.error(`[Web] Error fetching messages for channel ${req.params.channelId}:`, error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

router.get('/guilds/:guildId/audit-logs', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { user, action: actionType } = req.query;
    const guild = req.client.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found.' });
    }

    let userId = user;
    if (user && !/^\\d{17,19}$/.test(user)) {
      const members = await guild.members.fetch({ query: user });
      const member = members.first();
      userId = member ? member.id : '0'; // 見つからない場合は誰もマッチしないIDをセット
    }

    const auditLogs = await guild.fetchAuditLogs({
      limit: 100,
      user: userId || undefined,
      type: actionType ? AuditLogEvent[actionType] : undefined,
    });

    const logs = auditLogs.entries.map((log) => ({
      id: log.id,
      action: AuditLogEvent[log.action],
      target: log.target,
      executor: log.executor,
      reason: log.reason,
      changes: log.changes,
      createdAt: log.createdAt,
    }));

    res.json(logs);
  } catch (error) {
    console.error(`[Web] Error fetching audit logs for guild ${req.params.guildId}:`, error);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

router.post('/guilds/:guildId/channels/:channelId/messages', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return res.status(404).json({ error: 'Text channel not found' });
    }

    await channel.send(content);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error(`[Web] Error sending message to channel ${req.params.channelId}:`, error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

router.get('/guilds/:guildId/channels-detailed', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const channels = guild.channels.cache
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position,
        parentId: channel.parentId,
        permissionOverwrites: channel.permissionOverwrites.cache.map((ow) => ({
          id: ow.id,
          type: ow.type,
          allow: ow.allow.bitfield.toString(),
          deny: ow.deny.bitfield.toString(),
        })),
      }))
      .sort((a, b) => a.position - b.position);

    res.json(channels);
  } catch (error) {
    console.error(`[Web] Error fetching detailed channels:`, error);
    res.status(500).json({ error: 'Failed to fetch channels.' });
  }
});

router.post('/guilds/:guildId/channels', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { name, type, parentId, permissionOverwrites } = req.body;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    await guild.channels.create({ name, type, parent: parentId, permissionOverwrites });
    res.status(201).json({ success: true });
  } catch (error) {
    console.error(`[Web] Error creating channel:`, error);
    res.status(500).json({ error: 'Failed to create channel.' });
  }
});

router.patch('/guilds/:guildId/channels/:channelId', async (req, res) => {
  try {
    const { guildId, channelId } = req.params;
    const { name, parentId, permissionOverwrites } = req.body;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    await channel.edit({ name, parent: parentId, permissionOverwrites });
    res.json({ success: true });
  } catch (error) {
    console.error(`[Web] Error updating channel:`, error);
    res.status(500).json({ error: 'Failed to update channel.' });
  }
});

router.delete('/guilds/:guildId/channels/:channelId', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    await channel.delete();
    res.json({ success: true });
  } catch (error) {
    console.error(`[Web] Error deleting channel:`, error);
    res.status(500).json({ error: 'Failed to delete channel.' });
  }
});

router.post('/guilds/:guildId/channels/positions', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { positions } = req.body; // Array of { id, parentId }
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    // Step 1: Update the parent for any channel that moved categories, one by one.
    for (const pos of positions) {
      const channel = guild.channels.cache.get(pos.id);
      if (channel) {
        const currentParentId = channel.parentId || null;
        const newParentId = pos.parentId !== 'null' ? pos.parentId : null;
        if (currentParentId !== newParentId) {
          await channel.setParent(newParentId, { lockPermissions: false });
        }
      }
    }

    // Step 2: After parent changes, set the final ordering for all channels.
    const orderingPayload = positions.map((p, index) => ({
      channel: p.id,
      position: index,
    }));

    await guild.channels.setPositions(orderingPayload);

    res.json({ success: true, message: 'チャンネルの順序を更新しました。' });
  } catch (error) {
    console.error(`[Web] Error setting channel positions:`, error);
    res.status(500).json({ error: 'チャンネルの順序の更新に失敗しました。' });
  }
});

// --- CI/CD Endpoint ---

async function runCommand(command, args, log) {
  return new Promise((resolve, reject) => {
    log(`\n$ ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    child.stdout.on('data', (data) => log(data.toString()));
    child.stderr.on('data', (data) => log(data.toString()));

    child.on('close', (code) => {
      if (code === 0) {
        log(`\nProcess finished with exit code 0.`);
        resolve();
      } else {
        log(`\nProcess failed with exit code ${code}.`);
        reject(new Error(`Exit code ${code}`));
      }
    });
    child.on('error', (err) => {
      log(`\nFailed to start process: ${err.message}`);
      reject(err);
    });
  });
}

router.post('/ci/run', async (req, res) => {
  const { type } = req.body;
  const log = (data) => wsServer.broadcastCiCdLog(data);

  res.status(202).json({ message: `Task \"${type}\" started.` });

  try {
    log(`--- Starting task: ${type} at ${new Date().toISOString()} ---`);

    const runCi = async () => {
      log('\n--- Running CI tasks ---');
      await runCommand('git', ['add', '.'], log);
      await runCommand(
        'git',
        ['commit', '-m', `CI: Automatic commit at ${new Date().toISOString()}`],
        log
      );
      await runCommand('git', ['push'], log);
      await runCommand('npm', ['test'], log);
      log('\n--- CI tasks completed successfully ---');
    };

    const runCd = async () => {
      log('\n--- Running CD tasks ---');
      await runCommand('git', ['pull', 'origin', 'main'], log);
      await runCommand('npm', ['install'], log);
      await runCommand('pm2', ['restart', 'all'], log); // Assuming pm2 manages the app
      log('\n--- CD tasks completed successfully ---');
    };

    if (type === 'CI') {
      await runCi();
    } else if (type === 'CD') {
      await runCd();
    } else if (type === 'CI/CD') {
      await runCi();
      await runCd();
    }

    log(`\n--- Task \"${type}\" finished successfully. ---`);
  } catch (error) {
    log(`\n--- Task \"${type}\" failed: ${error.message} ---`);
  }
});

// --- Voice Channel Endpoints ---

router.post('/guilds/:guildId/voice/join', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channelId } = req.body;
    const guild = req.client.guilds.cache.get(guildId);

    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return res.status(404).json({ error: 'Voice channel not found' });
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: true, // Join muted by default
      selfDeaf: false, // Explicitly set selfDeaf to false
    });

    // The bot is now in the channel, we don't need to wait for the Ready state
    // as it was causing timeout issues.
    // await entersState(connection, VoiceConnectionStatus.Ready, 30e3);

    res.json({ success: true, message: `Joined ${channel.name}` });
  } catch (error) {
    console.error(`[Web] Error joining voice channel:`, error);
    res.status(500).json({ error: 'Failed to join voice channel.' });
  }
});

router.post('/guilds/:guildId/voice/leave', (req, res) => {
  try {
    const { guildId } = req.params;
    const connection = getVoiceConnection(guildId);

    if (connection) {
      connection.destroy();
      res.json({ success: true, message: 'Left voice channel' });
    } else {
      res.status(404).json({ error: 'Not in a voice channel' });
    }
  } catch (error) {
    console.error(`[Web] Error leaving voice channel:`, error);
    res.status(500).json({ error: 'Failed to leave voice channel.' });
  }
});

router.post('/guilds/:guildId/voice/mute', (req, res) => {
  const { guildId } = req.params;
  const { mute } = req.body;
  const connection = getVoiceConnection(guildId);

  if (connection) {
    connection.receiver.voiceConnection.rejoin({
      ...connection.joinConfig,
      selfMute: mute,
    });
    res.json({ success: true, message: `Mute state set to ${mute}` });
  } else {
    res.status(404).json({ error: 'Not in a voice channel' });
  }
});

router.post('/guilds/:guildId/voice/deafen', (req, res) => {
  const { guildId } = req.params;
  const { deafen } = req.body;
  const connection = getVoiceConnection(guildId);

  if (connection) {
    connection.receiver.voiceConnection.rejoin({
      ...connection.joinConfig,
      selfDeaf: deafen,
    });
    res.json({ success: true, message: `Deafen state set to ${deafen}` });
  } else {
    res.status(404).json({ error: 'Not in a voice channel' });
  }
});

router.get('/guilds/:guildId/voice-members/:channelId', async (req, res) => {
  try {
    const { guildId, channelId } = req.params; // ここを修正
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return res.status(404).json({ error: 'Voice channel not found' });
    }

    const members = channel.members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      avatarURL: member.user.displayAvatarURL(),
    }));

    res.json(members);
  } catch (error) {
    console.error(`[Web] Error fetching voice channel members:`, error);
    res.status(500).json({ error: 'Failed to fetch voice channel members.' });
  }
});

router.get('/guilds/:guildId/bot-voice-state', (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = req.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const botMember = guild.members.cache.get(req.client.user.id);
    if (!botMember || !botMember.voice.channel) {
      return res.json({ inVoiceChannel: false });
    }

    const connection = getVoiceConnection(guildId);
    const selfMute = botMember.voice.selfMute;
    const selfDeaf = botMember.voice.selfDeaf;

    res.json({
      inVoiceChannel: true,
      channelId: botMember.voice.channel.id,
      channelName: botMember.voice.channel.name,
      selfMute: selfMute,
      selfDeaf: selfDeaf,
      connected:
        !!connection &&
        connection.state.status !== VoiceConnectionStatus.Disconnected &&
        connection.state.status !== VoiceConnectionStatus.Destroyed,
    });
  } catch (error) {
    console.error(`[Web] Error fetching bot voice state:`, error);
    res.status(500).json({ error: 'Failed to fetch bot voice state.' });
  }
});

module.exports = router;
