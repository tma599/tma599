const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { ngWords, saveNgWords, normalizeJapanese } = require('../../models/ngwords');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ngword')
    .setDescription('NGワードを設定・管理します。')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('実行するアクション')
        .setRequired(true)
        .addChoices(
          { name: '追加', value: 'add' },
          { name: '削除', value: 'remove' },
          { name: '一覧表示', value: 'list' }
        )
    )
    .addStringOption((option) =>
      option.setName('word').setDescription('NGワード').setRequired(false)
    ),
  async execute(interaction) {
    const action = interaction.options.getString('action');
    const originalWord = interaction.options.getString('word');
    const guildId = interaction.guild.id;

    if (!ngWords.has(guildId)) {
      ngWords.set(guildId, []);
    }
    const guildNgWords = ngWords.get(guildId);

    let replyContent = '';

    switch (action) {
      case 'add':
        if (!originalWord || originalWord.trim() === '') {
          return interaction.reply({
            content: 'NGワードを指定してください。',
            flags: MessageFlags.Ephemeral,
          });
        }
        const normalizedWord = await normalizeJapanese(originalWord.trim());

        if (guildNgWords.some((w) => w.normalized === normalizedWord)) {
          replyContent = `NGワード「${originalWord}」は既に登録されています。`;
        } else {
          guildNgWords.push({ original: originalWord.trim(), normalized: normalizedWord });
          await saveNgWords();
          replyContent = `NGワード「${originalWord}」を追加しました。`;
        }
        break;

      case 'remove':
        if (!originalWord) {
          return interaction.reply({
            content: '削除するNGワードを指定してください。',
            flags: MessageFlags.Ephemeral,
          });
        }
        const wordToRemove = originalWord.trim();
        const initialLength = guildNgWords.length;
        const newGuildNgWords = guildNgWords.filter((w) => w.original !== wordToRemove);

        if (newGuildNgWords.length < initialLength) {
          ngWords.set(guildId, newGuildNgWords);
          await saveNgWords();
          replyContent = `NGワード「${wordToRemove}」を削除しました。`;
        } else {
          replyContent = `NGワード「${wordToRemove}」は見つかりませんでした。`;
        }
        break;

      case 'list':
        if (guildNgWords.length === 0) {
          replyContent = '現在、登録されているNGワードはありません。';
        } else {
          const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('登録されているNGワード一覧')
            .setDescription(guildNgWords.map((w) => w.original).join('\n'));
          return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        break;

      default:
        replyContent = '無効なアクションです。';
        break;
    }

    await interaction.reply({ content: replyContent, flags: MessageFlags.Ephemeral });
  },
};
