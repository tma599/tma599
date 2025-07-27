const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('server').setDescription('サーバーの情報を表示します。'),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    let members;
    try {
      await guild.members.fetch();
      members = guild.members.cache.map((m) => m.user.tag);
    } catch (err) {
      console.error('[エラー] サーバーメンバーの取得に失敗しました。', err);
      return interaction.editReply({
        content:
          'メンバー情報の取得に失敗しました。Botに「Server Members Intent」と必要な権限があるか確認してください。',
        flags: MessageFlags.Ephemeral,
      });
    }
    const totalMembers = guild.memberCount;
    const pageSize = 10;
    const totalPages = Math.ceil(members.length / pageSize);
    let page = 0;

    const generateEmbed = (p) => {
      const slice = members.slice(p * pageSize, p * pageSize + pageSize);
      return new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
          { name: 'サーバーID', value: guild.id, inline: true },
          { name: '作成日', value: guild.createdAt.toLocaleDateString(), inline: true },
          { name: 'メンバー数', value: `${totalMembers}`, inline: true },
          { name: 'オーナー', value: `<@${guild.ownerId}>`, inline: true },
          { name: 'チャンネル数', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'ロール数', value: `${guild.roles.cache.size}`, inline: true },
          { name: 'ブーストレベル', value: `${guild.premiumTier}`, inline: true },
          { name: 'ブースト数', value: `${guild.premiumSubscriptionCount}`, inline: true },
          {
            name: `メンバー一覧 (ページ ${p + 1}/${totalPages})`,
            value: slice.join('\n') || 'メンバーがいません。',
          }
        )
        .setTimestamp()
        .setFooter({ text: `Requested by ${interaction.user.tag}` });
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('previous_page')
        .setLabel('前へ')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('次へ')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(totalPages <= 1)
    );

    const message = await interaction.editReply({
      embeds: [generateEmbed(page)],
      components: [row],
      fetchReply: true,
      flags: MessageFlags.Ephemeral,
    });
    const collector = message.createMessageComponentCollector({ time: 60_000 });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({
          content: 'あなた以外は操作できません。',
          flags: MessageFlags.Ephemeral,
        });
      }
      page += btn.customId === 'next_page' ? 1 : -1;
      row.components[0].setDisabled(page === 0);
      row.components[1].setDisabled(page === totalPages - 1);
      await btn.update({ embeds: [generateEmbed(page)], components: [row] });
    });

    collector.on('end', () => {
      row.components.forEach((c) => c.setDisabled(true));
      interaction.editReply({ components: [row] });
    });
  },
};
