const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('このボットのコマンドについての詳細なヘルプを表示します。'),
  async execute(interaction) {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🤖 Bot コマンドヘルプ')
      .setDescription('このBotが提供するコマンドの一覧と説明です。')
      .addFields(
        { name: '\n📜 一般コマンド', value: ' ' },
        { name: '/help', value: 'このヘルプメッセージを表示します。' },
        { name: '/server', value: 'サーバーの各種情報を表示します。' },
        { name: '\n🔧 バックアップ＆復元コマンド (要: サーバーの管理権限)', value: ' ' },
        {
          name: '/backup name:<バックアップ名>',
          value: '現在のサーバー構成を、あなた専用の個人用バックアップとして保存します。',
        },
        {
          name: '/restore name:<バックアップ名>',
          value:
            'あなたの個人用バックアップからサーバーを復元します（既存のチャンネルは維持されます）。',
        },
        {
          name: '/aothbackuprestor name:<自動バックアップ名>',
          value: '自動バックアップからサーバーを復元します（既存のチャンネルは維持されます）。',
        },
        {
          name: '/create-template',
          value:
            '**[危険]** Botオーナーのテンプレートでサーバーを完全に上書きします。テンプレートにないチャンネルは全て削除されます。',
        },
        {
          name: '/backup-manage action:<操作> [name:<ファイル名>]',
          value:
            'あなたの個人用バックアップの、一覧表示、ロック、削除などを行います。「list」アクションではファイル名の指定は不要です。',
        },
        {
          name: '/backuptimer schedule:<頻度> time:<時間帯> hour:<時> minute:<分>',
          value: 'サーバーの自動バックアップスケジュールを設定します。',
        },
        {
          name: '/backuptimer-manage action:<操作>',
          value: 'サーバーの自動バックアップのON/OFFを切り替えます。',
        },
        {
          name: '/deletemessage user:<ユーザー> count:<件数>',
          value:
            '指定されたユーザーのメッセージを、指定された件数だけ削除します。(最大100件、14日以内のメッセージのみ)',
        },
        { name: '\n⚠️ ご利用上の注意', value: ' ' },
        {
          name: '🚨【重要】権限の設定',
          value:
            '**このBotのロールが、管理したい全てのロールより上にあることを確認してください。** そうしないと、権限不足でロールの復元に失敗します。',
        },
        {
          name: 'サーバーの複製について',
          value:
            'あるサーバーで `/backup` したファイルを、別のサーバーで `/restore` することで、サーバーの構成（チャンネルやロール）を複製できます。',
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Server Backup Bot' });

    await interaction.reply({ embeds: [helpEmbed], flags: MessageFlags.Ephemeral });
  },
};
