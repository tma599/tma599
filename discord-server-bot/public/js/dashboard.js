// --- State ---
let allGuilds = [];
let currentGuildData = null;

// --- DOM Elements ---
const logLink = document.getElementById('log-link');
const guildSelector = document.getElementById('guild-selector');
const mainContent = document.getElementById('main-content');
const guildView = document.getElementById('guild-view');
const logView = document.getElementById('log-view');
const welcomeView = document.getElementById('welcome-view');
const serverInfoContainer = document.getElementById('server-info-container');
const commandContainer = document.getElementById('command-container');
const logContainer = document.getElementById('log-container');
const hamburgerMenu = document.getElementById('hamburger-menu');
const adminSidebar = document.getElementById('admin-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const adminCommandsContainer = document.getElementById('admin-commands');
const chatView = document.getElementById('chat-view');
const chatHeader = document.getElementById('chat-header');
let chatMessages = document.getElementById('chat-messages');
let chatMessageInput = document.getElementById('chat-message-input');
let chatSendButton = document.getElementById('chat-send-button');

// --- Translations ---
const permissionTranslations = {
  CreateInstantInvite: '招待を作成',
  KickMembers: 'メンバーをキック',
  BanMembers: 'メンバーをBAN',
  Administrator: '管理者',
  ManageChannels: 'チャンネルの管理',
  ManageGuild: 'サーバーの管理',
  AddReactions: 'リアクションの追加',
  ViewAuditLog: '監査ログを表示',
  PrioritySpeaker: '優先スピーカー',
  Stream: '配信',
  ViewChannel: 'チャンネルを表示',
  SendMessages: 'メッセージを送信',
  SendTTSMessages: 'TTSメッセージを送信',
  ManageMessages: 'メッセージの管理',
  EmbedLinks: '埋め込みリンク',
  AttachFiles: 'ファイルの添付',
  ReadMessageHistory: 'メッセージ履歴を読む',
  MentionEveryone: '@everyone、@here、全てのロールにメンション',
  UseExternalEmojis: '外部の絵文字を使用する',
  ViewGuildInsights: 'サーバーインサイトを表示',
  Connect: '接続',
  Speak: '発言',
  MuteMembers: 'メンバーをミュート',
  DeafenMembers: 'メンバーのスピーカーをミュート',
  MoveMembers: 'メンバーを移動',
  UseVAD: '音声検出を使用',
  ChangeNickname: 'ニックネームの変更',
  ManageNicknames: 'ニックネームの管理',
  ManageRoles: 'ロールの管理',
  ManageWebhooks: 'ウェブフックの管理',
  ManageEmojisAndStickers: '絵文字とスタンプの管理',
  UseApplicationCommands: 'アプリケーションコマンドの使用',
  RequestToSpeak: 'スピーカー参加をリクエスト',
  ManageEvents: 'イベントの管理',
  ManageThreads: 'スレッドの管理',
  CreatePublicThreads: '公開スレッドの作成',
  CreatePrivateThreads: 'プライベートスレッドの作成',
  UseExternalStickers: '外部スタンプの使用',
  SendMessagesInThreads: 'スレッドでメッセージを送信',
  UseEmbeddedActivities: '埋め込みアクティビティの開始',
  ModerateMembers: 'メンバーのタイムアウト',
};

// --- Utilities ---
// UI animation added
function getContrastingTextColor(hexColor) {
  if (!hexColor) return '#ffffff';
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  // Using the HSP value, determine whether the color is light or dark
  return hsp > 127.5 ? '#000000' : '#ffffff';
}

// --- Sidebar ---
function toggleSidebar() {
  adminSidebar.classList.toggle('active');
  sidebarOverlay.classList.toggle('active');
}

// --- View Management ---
function showView(viewId) {
  // UI animation added
  const activeView = $('#main-content .view.active');
  if (activeView.length) {
    activeView.removeClass('active');
  }

  const newView = $('#' + viewId);
  if (newView.length) {
    newView.addClass('active').addClass('fade-in');
    // Remove class after animation to allow re-triggering
    setTimeout(() => newView.removeClass('fade-in'), 500);
  }

  logLink.classList.toggle('active', viewId === 'log-view');
  if (viewId !== 'guild-view') {
    document.querySelectorAll('.guild-tab').forEach((t) => t.classList.remove('active'));
    hamburgerMenu.style.display = 'none';
  }
}

// --- API Functions ---
async function fetchApi(url, options) {
  try {
    const response = await fetch(url, options);
    if (response.status === 401) {
      window.location.reload();
      return null;
    }
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: '不明なエラーが発生しました。' }));
      throw new Error(errorData.error);
    }
    return response.status === 204 ? {} : await response.json();
  } catch (error) {
    showToast(error.message, true);
    return null;
  }
}

// --- HTML Generation ---
function generateServerInfoHTML(guild) {
  const sortedRoles = [...guild.roles].sort((a, b) => b.position - a.position);
  return `
        <div class="info-grid">
            <div class="info-card"><h3>サーバー情報</h3><ul><li><strong>メンバー数:</strong> ${guild.memberCount}</li></ul></div>
            <div class="info-card" id="channel-list-card"><h3>チャンネルリスト</h3><div id="channel-list-content"></div></div>
            <div class="info-card"><h3>ロール (${sortedRoles.length})</h3><div style="display:flex; flex-wrap:wrap;">
                ${sortedRoles
                  .map((r) => {
                    const bgColor = r.color === '#000000' ? '#99aab5' : r.color;
                    const textColor = getContrastingTextColor(bgColor); // UI animation added
                    return `<span class="role-pill" style="background-color:${bgColor}; color: ${textColor};">${r.name}</span>`;
                  })
                  .join('')}
            </div></div>
        </div>`;
}

function renderChannelList(guild) {
  const allChannels = [...guild.channels].sort((a, b) => a.position - b.position);
  const categories = allChannels
    .filter((c) => c.type === 4)
    .sort((a, b) => a.position - b.position);
  const getChannelIcon = (channel) => {
    switch (channel.type) {
      case 0:
        return '#';
      case 2:
        return '🔊';
      case 4:
        return '📁';
      case 5:
        return '📢';
      case 10:
      case 11:
      case 12:
        return '💬';
      case 13:
        return '🎤';
      case 15:
        return '📰';
      default:
        return '❓';
    }
  };
  const buildChannelItemHTML = (channel) =>
    `<li data-channel-id="${channel.id}" data-channel-name="${channel.name}" class="${channel.type === 0 ? 'text-channel' : ''}"><div>${getChannelIcon(channel)} ${channel.name}</div></li>`;
  let channelListHTML = '';
  const topLevelChannels = allChannels.filter((c) => !c.parentId && c.type !== 4);
  if (topLevelChannels.length > 0) {
    channelListHTML += `<div class="channel-category-group"><div class="channel-category-name" data-category-id="uncategorized"><svg class="icon" viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>カテゴリなし</div><ul class="channel-list-group" id="channel-list-uncategorized" style="display: block;">${topLevelChannels.map(buildChannelItemHTML).join('')}</ul></div>`;
  }
  categories.forEach((cat) => {
    const channelsInCategory = allChannels
      .filter((c) => c.parentId === cat.id)
      .sort((a, b) => a.type - b.type || a.position - b.position);
    if (channelsInCategory.length > 0) {
      channelListHTML += `<div class="channel-category-group"><div class="channel-category-name" data-category-id="${cat.id}"><svg class="icon" viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>${cat.name}</div><ul class="channel-indent channel-list-group" id="channel-list-${cat.id}" style="display: block;">${channelsInCategory.map(buildChannelItemHTML).join('')}</ul></div>`;
    }
  });
  document.getElementById('channel-list-content').innerHTML = channelListHTML;
  document.querySelectorAll('.text-channel').forEach((item) => {
    item.addEventListener('click', () => {
      selectChannel(guild.id, item.dataset.channelId, item.dataset.channelName);
    });
  });
}

function generateCommandTabsHTML() {
  return `
        <div id="command-tabs">
            <button class="command-tab-button active" data-tab="backup">バックアップ</button>
            <button class="command-tab-button" data-tab="reaction-role">リアクションロール</button>
            <button class="command-tab-button" data-tab="ng-word">NGワード</button>
            <button class="command-tab-button" data-tab="delete-message">メッセージ削除</button>
        </div>
        <div id="command-panes"></div>`;
}

// --- Main Functions ---
async function initializeDashboard() {
  logLink.addEventListener('click', (e) => {
    e.preventDefault();
    selectLogView();
  });
  hamburgerMenu.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', toggleSidebar);
  connectWebSocket();

  const guilds = await fetchApi('/api/guilds');

  if (guilds && guilds.length > 0) {
    allGuilds = guilds;
    guildSelector.innerHTML = allGuilds
      .map(
        (g) =>
          `<div class="guild-tab" data-guild-id="${g.id}" title="${g.name}"><img src="${g.iconURL || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="${g.name}"></div>`
      )
      .join('');
    guildSelector
      .querySelectorAll('.guild-tab')
      .forEach((tab) => tab.addEventListener('click', () => selectGuild(tab.dataset.guildId)));

    const initialId = window.location.hash.substring(1);
    if (initialId === 'logs') {
      selectLogView();
    } else if (initialId && allGuilds.some((g) => g.id === initialId)) {
      selectGuild(initialId);
    } else {
      showView('welcome-view');
    }
  } else {
    // API失敗時やギルドがない場合
    showView('welcome-view');
    // ユーザーに何が起こったかフィードバックを提供する
    if (guilds === null) {
      // fetchApiがエラーでnullを返した場合
      showToast('サーバー情報の取得に失敗しました。ページを再読み込みしてみてください。', true);
    }
  }
}

function selectLogView() {
  showView('log-view');
  window.location.hash = 'logs';
}

async function selectGuild(guildId) {
  if (!guildId) return;
  showView('guild-view');
  window.location.hash = guildId;
  document.querySelectorAll('.guild-tab').forEach((t) => t.classList.remove('active'));
  document.querySelector(`.guild-tab[data-guild-id="${guildId}"]`).classList.add('active');
  serverInfoContainer.innerHTML = "<div class='info-card'><h2>読み込み中...</h2></div>";
  commandContainer.innerHTML = '';
  const guildData = await fetchApi(`/api/guilds/${guildId}`);
  if (!guildData) return;
  currentGuildData = guildData;
  serverInfoContainer.innerHTML = generateServerInfoHTML(guildData);
  renderChannelList(guildData);
  hamburgerMenu.style.display = 'block';
  renderAdminCommands(guildId);
  commandContainer.innerHTML = generateCommandTabsHTML();
  attachCommandTabListeners();
  openCommandTab('backup');
}

let isLoadingMoreMessages = false;
let noMoreNewerMessages = false; // Bug fix: Add flag to prevent repeated toast notifications

async function selectChannel(guildId, channelId, channelName) {
  showView('chat-view');
  chatHeader.innerHTML = `
        <div class="chat-header-title"># ${channelName}</div>
        <div class="date-search-form">
            <input type="date" id="message-date-input">
            <button id="message-search-btn" class="btn-primary">検索</button>
            <button id="message-search-reset-btn" class="btn-secondary">リセット</button>
        </div>
    `;
  chatHeader.dataset.channelId = channelId; // Bug fix: Store current channel ID
  chatMessages.innerHTML = '<p>メッセージを読み込み中...</p>';
  isLoadingMoreMessages = false;
  noMoreNewerMessages = false; // Bug fix: Reset flag on channel change

  // UI improvement: Bidirectional infinite scroll
  chatMessages.onscroll = async () => {
    if (isLoadingMoreMessages) return;

    // Load older messages (scroll up)
    if (chatMessages.scrollTop === 0) {
      const oldestMessageId = chatMessages.querySelector('.chat-message:first-child')?.dataset
        .messageId;
      if (oldestMessageId) {
        await fetchAndRenderMessages(guildId, channelId, { before: oldestMessageId });
      }
    }

    // Load newer messages (scroll down)
    // Bug fix: Check flag to prevent repeated calls
    if (
      chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 1 &&
      !noMoreNewerMessages
    ) {
      const newestMessageId = chatMessages.querySelector('.chat-message:last-child')?.dataset
        .messageId;
      if (newestMessageId) {
        await fetchAndRenderMessages(guildId, channelId, { after: newestMessageId });
      }
    }
  };

  document.getElementById('message-search-btn').addEventListener('click', async () => {
    const date = document.getElementById('message-date-input').value;
    if (date) {
      chatMessages.innerHTML = '<p>指定された日付のメッセージを検索中...</p>';
      noMoreNewerMessages = false; // Bug fix: Reset flag for new search
      await fetchAndRenderMessages(guildId, channelId, { date: date, isNewSearch: true });
    }
  });

  document.getElementById('message-search-reset-btn').addEventListener('click', () => {
    selectChannel(guildId, channelId, channelName);
  });

  // Cleanup and setup send functionality
  const newChatSendButton = chatSendButton.cloneNode(true);
  chatSendButton.parentNode.replaceChild(newChatSendButton, chatSendButton);
  chatSendButton = newChatSendButton;

  const newChatMessageInput = chatMessageInput.cloneNode(true);
  chatMessageInput.parentNode.replaceChild(newChatMessageInput, chatMessageInput);
  chatMessageInput = newChatMessageInput;

  const sendMessageHandler = () => sendMessage(guildId, channelId);
  chatSendButton.addEventListener('click', sendMessageHandler);
  chatMessageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageHandler();
    }
  });

  await fetchAndRenderMessages(guildId, channelId, { isNewSearch: true });
}

async function fetchAndRenderMessages(guildId, channelId, options = {}) {
  if (isLoadingMoreMessages) return;
  isLoadingMoreMessages = true;

  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.textContent = 'メッセージを読み込み中...';

  if (options.isNewSearch || options.date) {
    chatMessages.innerHTML = '';
  }

  if (options.before) {
    chatMessages.insertAdjacentElement('afterbegin', loadingIndicator);
  } else {
    chatMessages.appendChild(loadingIndicator);
  }

  const query = new URLSearchParams({ limit: 50, ...options }).toString();
  const messages = await fetchApi(`/api/guilds/${guildId}/channels/${channelId}/messages?${query}`);

  loadingIndicator.remove();

  if (messages && messages.length > 0) {
    const currentScrollHeight = chatMessages.scrollHeight;
    renderMessages(messages, {
      prepend: !!options.before,
      isNew: options.isNewSearch || options.date,
    });
    if (options.before) {
      chatMessages.scrollTop = chatMessages.scrollHeight - currentScrollHeight;
    } else if (options.isNewSearch && !options.date) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } else {
    const message = options.before
      ? 'これ以上古いメッセージはありません。'
      : options.after
        ? 'これ以上新しいメッセージはありません。'
        : 'メッセージが見つかりませんでした。';
    showToast(message);
    // Bug fix: Set flag when end of newer messages is reached
    if (options.after) {
      noMoreNewerMessages = true;
    }
  }

  isLoadingMoreMessages = false;
}

function renderMessages(messages, options = {}) {
  const messagesHtml = messages
    .map((msg) => {
      const attachmentHtml =
        msg.attachments.length > 0
          ? `<div class="chat-attachments">
           <button class="attachment-placeholder" data-attachments='${JSON.stringify(msg.attachments)}'>
             画像 (${msg.attachments.length}件)
           </button>
         </div>`
          : '';

      const embedHtml =
        msg.embeds.length > 0
          ? msg.embeds
              .map(
                (embed) => `
        <div class="chat-embed">
          ${embed.author ? `<div class="embed-author"><img src="${embed.author.iconURL}" class="embed-author-icon">${embed.author.name}</div>` : ''}
          ${embed.title ? `<div class="embed-title">${embed.title}</div>` : ''}
          ${embed.description ? `<div class="embed-description">${embed.description}</div>` : ''}
          <div class="embed-fields">
            ${embed.fields ? embed.fields.map((field) => `<div class="embed-field"><div class="embed-field-name">${field.name}</div><div class="embed-field-value">${field.value}</div></div>`).join('') : ''}
          </div>
          ${embed.image ? `<img src="${embed.image.url}" class="embed-image">` : ''}
          ${embed.thumbnail ? `<img src="${embed.thumbnail.url}" class="embed-thumbnail">` : ''}
           ${embed.footer ? `<div class="embed-footer"><img src="${embed.footer.iconURL}" class="embed-footer-icon">${embed.footer.text}</div>` : ''}
        </div>
      `
              )
              .join('')
          : '';

      const reactionHtml =
        msg.reactions.length > 0
          ? `<div class="chat-reactions">
           ${msg.reactions
             .map(
               (reaction) => `
             <button class="reaction-button ${reaction.reacted ? 'reacted' : ''}" data-emoji="${reaction.emoji}">
               <span class="reaction-emoji">${reaction.emoji.includes(':') ? `<img src="https://cdn.discordapp.com/emojis/${reaction.emoji.split(':')[1]}.png">` : reaction.emoji}</span>
               <span class="reaction-count">${reaction.count}</span>
             </button>
           `
             )
             .join('')}
         </div>`
          : '';

      return `
        <div class="chat-message" data-message-id="${msg.id}">
            <img src="${msg.author.avatarURL}" alt="${msg.author.username}" class="chat-avatar">
            <div class="chat-message-content">
                <div class="chat-message-header">
                    <span class="chat-username">${msg.author.username}</span>
                    <span class="chat-timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
                </div>
                <div class="chat-message-body">${msg.content}</div>
                ${attachmentHtml}
                ${embedHtml}
                ${reactionHtml}
            </div>
        </div>
    `;
    })
    .join('');

  if (options.isNew) {
    chatMessages.innerHTML = messagesHtml;
  } else if (options.prepend) {
    chatMessages.insertAdjacentHTML('afterbegin', messagesHtml);
  } else {
    chatMessages.insertAdjacentHTML('beforeend', messagesHtml);
  }
}

chatMessages.addEventListener('click', async (e) => {
  const attachmentPlaceholder = e.target.closest('.attachment-placeholder');
  if (attachmentPlaceholder) {
    const attachments = JSON.parse(attachmentPlaceholder.dataset.attachments);
    const container = attachmentPlaceholder.parentElement;
    container.innerHTML = attachments
      .map(
        (a) =>
          `<img src="${a.url}" class="chat-attachment-image" style="max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 5px;">`
      )
      .join('');
    return;
  }

  const reactionButton = e.target.closest('.reaction-button');
  if (reactionButton) {
    const messageId = reactionButton.closest('.chat-message').dataset.messageId;
    const emoji = reactionButton.dataset.emoji;
    const guildId = currentGuildData.id;
    const channelId = chatHeader.dataset.channelId;
    const hasReacted = reactionButton.classList.contains('reacted');

    const result = await fetchApi(
      `/api/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: hasReacted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      }
    );

    if (result && result.success) {
      const reactionContainer = reactionButton.parentElement;
      const newReactionHtml = result.reactions
        .map(
          (reaction) => `
           <button class="reaction-button ${reaction.reacted ? 'reacted' : ''}" data-emoji="${reaction.emoji}">
             <span class="reaction-emoji">${reaction.emoji.includes(':') ? `<img src="https://cdn.discordapp.com/emojis/${reaction.emoji.split(':')[1]}.png">` : reaction.emoji}</span>
             <span class="reaction-count">${reaction.count}</span>
           </button>
         `
        )
        .join('');
      reactionContainer.innerHTML = newReactionHtml;
    }
  }
});

async function sendMessage(guildId, channelId) {
  const content = chatMessageInput.value.trim();
  if (!content) return;

  const result = await fetchApi(`/api/guilds/${guildId}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (result) {
    chatMessageInput.value = '';
    // Optionally, you can refresh the messages to see the new one immediately
    fetchAndRenderMessages(guildId, channelId);
  }
}

function attachCommandTabListeners() {
  document.querySelectorAll('.command-tab-button').forEach((button) => {
    button.addEventListener('click', () => openCommandTab(button.dataset.tab));
  });
}

function openCommandTab(tabName) {
  document.querySelectorAll('.command-tab-button').forEach((b) => b.classList.remove('active'));
  document.querySelector(`.command-tab-button[data-tab="${tabName}"]`).classList.add('active');
  const panesContainer = document.getElementById('command-panes');
  let html = '',
    listenerAttacher = () => {};
  switch (tabName) {
    case 'backup':
      html = getBackupPaneHTML();
      listenerAttacher = attachBackupListeners;
      break;
    case 'reaction-role':
      html = getReactionRolePaneHTML();
      listenerAttacher = attachReactionRoleListeners;
      break;
    case 'ng-word':
      html = getNgWordPaneHTML();
      listenerAttacher = attachNgWordListeners;
      break;
    case 'delete-message':
      html = getDeleteMessagePaneHTML();
      listenerAttacher = attachDeleteMessageListeners;
      break;
  }
  panesContainer.innerHTML = `<div class="command-tab-pane active">${html}</div>`;
  listenerAttacher();
}

// --- Admin Commands ---
function renderAdminCommands(guildId) {
  adminCommandsContainer.innerHTML = `
        <button id="restart-bot-btn">Botを再起動</button>
        <button id="reload-commands-btn">コマンドをリロード</button>
        <button id="role-management-btn">ロール管理</button>
        <button id="member-management-btn">メンバー管理</button>
        <button id="channel-management-btn">チャンネル管理</button>
        <button id="audit-log-btn">監査ログ</button>
        <button id="cicd-btn">CI/CD</button>
    `;
  document.getElementById('restart-bot-btn').addEventListener('click', async () => {
    if (!confirm('本当にBotを再起動しますか？')) return;
    const result = await fetchApi('/api/admin/restart', { method: 'POST' });
    if (result) {
      showToast(result.message || 'Botの再起動を要求しました。');
      toggleSidebar();
    }
  });
  document.getElementById('reload-commands-btn').addEventListener('click', async () => {
    if (!confirm('本当にコマンドをリロードしますか？')) return;
    const result = await fetchApi('/api/admin/reload', { method: 'POST' });
    if (result) {
      showToast(result.message || 'コマンドのリロードを要求しました。');
      toggleSidebar();
    }
  });
  document.getElementById('role-management-btn').addEventListener('click', () => {
    toggleSidebar();
    openRoleManager(guildId);
  });
  document.getElementById('member-management-btn').addEventListener('click', () => {
    toggleSidebar();
    openMemberManager(guildId);
  });
  document.getElementById('channel-management-btn').addEventListener('click', () => {
    toggleSidebar();
    openChannelManager(guildId);
  });
  document.getElementById('audit-log-btn').addEventListener('click', () => {
    toggleSidebar();
    openAuditLogViewer(guildId);
  });
  document.getElementById('cicd-btn').addEventListener('click', () => {
    toggleSidebar();
    openCiCdView();
  });
}

async function openAuditLogViewer(guildId) {
  showView('audit-log-view');
  const view = document.getElementById('audit-log-view');
  view.innerHTML = `
        <div class="management-section">
            <h3>監査ログ</h3>
            <div class="form-group" style="display: flex; gap: 1em; align-items: flex-end; flex-wrap: wrap;">
                <div style="flex-grow: 1;">
                    <label for="audit-log-user">ユーザーで絞り込み</label>
                    <input type="text" id="audit-log-user" placeholder="ユーザーIDまたは名前を入力">
                </div>
                <div style="flex-grow: 1;">
                    <label for="audit-log-action">アクションで絞り込み</label>
                    <select id="audit-log-action"><option value="">すべて</option></select>
                </div>
            </div>
            <div style="overflow-x: auto;">
                <table id="audit-log-table"><thead><tr><th>日時</th><th>実行者</th><th>アクション</th><th>対象</th><th>理由</th></tr></thead><tbody><tr><td colspan="5">読み込み中...</td></tr></tbody></table>
            </div>
        </div>
    `;

  await fetchAndRenderAuditLogs(guildId);

  document
    .getElementById('audit-log-user')
    .addEventListener('input', () => fetchAndRenderAuditLogs(guildId));
  document
    .getElementById('audit-log-action')
    .addEventListener('change', () => fetchAndRenderAuditLogs(guildId));
}

// UI animation added: CI/CD View
function openCiCdView() {
  showView('cicd-view');
  const cicdView = document.getElementById('cicd-view');

  // Only initialize the view if it's empty
  if (cicdView.innerHTML.trim() === '') {
    cicdView.innerHTML = `
            <div class="management-section">
                <h3>CI/CD パイプライン</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button id="run-ci-btn" class="btn-primary">CI を実行 (Push & Test)</button>
                    <button id="run-cd-btn" class="btn-success">CD を実行 (Pull & Deploy)</button>
                    <button id="run-cicd-btn" class="btn-warning">CI/CD を実行 (CI then CD)</button>
                </div>
                <h4>実行ログ</h4>
                <div id="cicd-log-container">ログがここに表示されます...</div>
            </div>
        `;

    const cicdLogContainer = document.getElementById('cicd-log-container');

    // Event listeners for CI/CD buttons
    document
      .getElementById('run-ci-btn')
      .addEventListener('click', () => runCiCdProcess('CI', cicdLogContainer));
    document
      .getElementById('run-cd-btn')
      .addEventListener('click', () => runCiCdProcess('CD', cicdLogContainer));
    document
      .getElementById('run-cicd-btn')
      .addEventListener('click', () => runCiCdProcess('CI/CD', cicdLogContainer));
  }
}

async function runCiCdProcess(type, logContainer) {
  // The log container is intentionally not cleared here.
  // The backend will send log updates via WebSocket.
  try {
    const response = await fetchApi('/api/ci/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (response) {
      showToast(`${type} プロセスを開始しました。ログを確認してください。`);
    }
  } catch (error) {
    const errorMessage = `${type} プロセスの開始に失敗しました: ${error.message}`;
    showToast(errorMessage, true);
    // Also log the error to the CI/CD view itself
    if (logContainer) {
      logContainer.textContent += `\n--- ${errorMessage} ---\n`;
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }
}

// Modify connectWebSocket to handle CI_CD_LOG messages
function connectWebSocket() {
  const protocol = window.location.protocol === 'https' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${window.location.host}`);
  ws.onopen = () => {
    console.log('[WebSocket] Connection established.');
  };
  ws.onclose = () => {
    console.log('[WebSocket] Connection closed. Reconnecting in 5s...');
    setTimeout(connectWebSocket, 5000);
  };
  ws.onerror = (err) => {
    console.error('[WebSocket] Error:', err);
  };
  ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);

    if (type === 'NEW_MESSAGE') {
      const currentChannelId = chatHeader.dataset.channelId;
      if (currentChannelId && data.channelId === currentChannelId) {
        const isScrolledToBottom =
          chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 5;

        renderMessages([data], { append: true });

        if (isScrolledToBottom) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        noMoreNewerMessages = false;
      }
    } else if (type === 'CI_CD_LOG') {
      // UI animation added: Handle CI/CD logs
      const cicdLogContainer = document.getElementById('cicd-log-container');
      if (cicdLogContainer) {
        const isScrolledToBottom =
          cicdLogContainer.scrollHeight - cicdLogContainer.clientHeight <=
          cicdLogContainer.scrollTop + 5;
        cicdLogContainer.textContent += data;
        if (isScrolledToBottom) {
          cicdLogContainer.scrollTop = cicdLogContainer.scrollHeight;
        }
      }
    } else {
      const entry = document.createElement('div');
      entry.className = `log-entry ${type}`;
      entry.textContent = data;
      const isLogScrolledToBottom =
        logContainer.scrollHeight - logContainer.clientHeight <= logContainer.scrollTop + 5;
      logContainer.appendChild(entry);
      if (isLogScrolledToBottom) logContainer.scrollTop = logContainer.scrollHeight;
    }
  };
}

async function fetchAndRenderAuditLogs(guildId) {
  const user = document.getElementById('audit-log-user').value;
  const action = document.getElementById('audit-log-action').value;
  const tableBody = document.getElementById('audit-log-table').querySelector('tbody');
  tableBody.innerHTML = '<tr><td colspan="5">読み込み中...</td></tr>';

  const logs = await fetchApi(`/api/guilds/${guildId}/audit-logs?user=${user}&action=${action}`);

  if (!logs) {
    tableBody.innerHTML = '<tr><td colspan="5">監査ログの読み込みに失敗しました。</td></tr>';
    return;
  }

  if (logs.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">表示する監査ログはありません。</td></tr>';
    return;
  }

  const actionTranslations = {
    GuildUpdate: 'サーバー更新',
    ChannelCreate: 'チャンネル作成',
    ChannelUpdate: 'チャンネル更新',
    ChannelDelete: 'チャンネル削除',
    ChannelOverwriteCreate: 'チャンネル権限作成',
    ChannelOverwriteUpdate: 'チャンネル権限更新',
    ChannelOverwriteDelete: 'チャンネル権限削除',
    MemberKick: 'メンバーをキック',
    MemberPrune: 'メンバーを除名',
    MemberBanAdd: 'メンバーをBAN',
    MemberBanRemove: 'メンバーのBANを解除',
    MemberUpdate: 'メンバー更新',
    MemberRoleUpdate: 'メンバーのロール更新',
    MemberMove: 'メンバーを移動',
    MemberDisconnect: 'メンバーを切断',
    BotAdd: 'Bot追加',
    RoleCreate: 'ロール作成',
    RoleUpdate: 'ロール更新',
    RoleDelete: 'ロール削除',
    InviteCreate: '招待作成',
    InviteUpdate: '招待更新',
    InviteDelete: '招待削除',
    WebhookCreate: 'Webhook作成',
    WebhookUpdate: 'Webhook更新',
    WebhookDelete: 'Webhook削除',
    EmojiCreate: '絵文字作成',
    EmojiUpdate: '絵文字更新',
    EmojiDelete: '絵文字削除',
    MessageDelete: 'メッセージ削除',
    MessageBulkDelete: 'メッセージ一括削除',
    MessagePin: 'メッセージをピン留め',
    MessageUnpin: 'メッセージのピン留め解除',
    IntegrationCreate: '連携作成',
    IntegrationUpdate: '連携更新',
    IntegrationDelete: '連携削除',
    StageInstanceCreate: 'ステージインスタンス作成',
    StageInstanceUpdate: 'ステージインスタンス更新',
    StageInstanceDelete: 'ステージインスタンス削除',
    StickerCreate: 'スタンプ作成',
    StickerUpdate: 'スタンプ更新',
    StickerDelete: 'スタンプ削除',
    GuildScheduledEventCreate: 'イベント作成',
    GuildScheduledEventUpdate: 'イベント更新',
    GuildScheduledEventDelete: 'イベント削除',
    ThreadCreate: 'スレッド作成',
    ThreadUpdate: 'スレッド更新',
    ThreadDelete: 'スレッド削除',
    ApplicationCommandPermissionUpdate: 'アプリコマンド権限更新',
    AutoModerationRuleCreate: '自動モデレーションルール作成',
    AutoModerationRuleUpdate: '自動モDEレーションルール更新',
    AutoModerationRuleDelete: '自動モデレーションルール削除',
    AutoModerationBlockMessage: 'メッセージをブロック',
  };

  tableBody.innerHTML = logs
    .map(
      (log) => `
        <tr>
            <td class="text-center">${new Date(log.createdAt).toLocaleString()}</td>
            <td>${log.executor.tag}</td>
            <td>${actionTranslations[log.action] || log.action}</td>
            <td class="truncate-text">${log.target ? log.target.tag || log.target.name : 'N/A'}</td>
            <td>${log.reason || '理由なし'}</td>
        </tr>
    `
    )
    .join('');
}

async function openChannelManager(guildId) {
  showView('guild-view');
  serverInfoContainer.innerHTML = '';
  commandContainer.innerHTML = `
        <div class="management-section">
            <h3>チャンネル管理</h3>
            <div id="channel-manager-container"></div>
            <div style="margin-top: 20px;">
                <button id="add-channel-btn" class="btn-success">新規チャンネル作成</button>
                <button id="save-channel-order-btn" class="btn-primary" style="display: none; margin-left: 10px;">チャンネル順序を保存</button>
            </div>
        </div>
    `;
  attachChannelManagementListeners();
}

async function attachChannelManagementListeners() {
  const guildId = currentGuildData.id;
  const container = document.getElementById('channel-manager-container');
  if (!container) return;

  const channels = await fetchApi(`/api/guilds/${guildId}/channels-detailed`);
  if (!channels) {
    container.innerHTML = '<p>チャンネルの読み込みに失敗しました。</p>';
    return;
  }

  renderChannelManager(guildId, channels);

  document.getElementById('add-channel-btn').addEventListener('click', () => {
    openChannelModal(guildId, null, channels);
  });
}

function renderChannelManager(guildId, channels) {
  const container = document.getElementById('channel-manager-container');
  const { categories, uncategorized } = groupChannels(channels);

  container.innerHTML = `
        ${renderChannelCategory(guildId, { id: null, name: 'カテゴリなし' }, uncategorized, channels)}
        ${categories
          .map((category) =>
            renderChannelCategory(
              guildId,
              category,
              channels.filter((c) => c.parentId === category.id),
              channels
            )
          )
          .join('')}
    `;

  // Add event listeners for the edit buttons
  container.querySelectorAll('.edit-channel-btn').forEach((button) => {
    const channelId = button.closest('.channel-item').dataset.channelId;
    button.addEventListener('click', () => openChannelModal(guildId, channelId, channels));
  });

  makeChannelsDraggable(guildId);
}

function renderChannelCategory(guildId, category, channelsInCategory, allChannels) {
  return `
        <div class="channel-category-container" data-category-id="${category.id || 'null'}">
            <div class="channel-category-header">${category.name}</div>
            <div class="channel-list">
                ${channelsInCategory.map((channel) => renderChannelItem(guildId, channel)).join('')}
            </div>
        </div>
    `;
}

function renderChannelItem(guildId, channel) {
  return `
        <div class="channel-item" data-channel-id="${channel.id}" draggable="true">
            <span class="drag-handle">⠿</span>
            <span class="channel-item-name">${getChannelIcon(channel)} ${channel.name}</span>
            <button class="btn-primary btn-sm edit-channel-btn">編集</button>
            <button class="btn-danger btn-sm" onclick="deleteChannel('${guildId}', '${channel.id}', '${channel.name}')">削除</button>
        </div>
    `;
}

function groupChannels(channels) {
  const categories = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const uncategorized = channels
    .filter((c) => !c.parentId && c.type !== 4)
    .sort((a, b) => a.position - b.position);
  return { categories, uncategorized };
}

function getChannelIcon(channel) {
  switch (channel.type) {
    case 0:
      return '#'; // Text
    case 2:
      return '🔊'; // Voice
    case 4:
      return '📁'; // Category
    case 5:
      return '📢'; // Announcement
    case 13:
      return '🎤'; // Stage
    case 15:
      return '📰'; // Forum
    default:
      return '❓';
  }
}

// 汎用的なドラッグ要素取得関数
function getDragAfterElement(container, y, selector) {
  const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

function makeChannelsDraggable(guildId) {
  const containers = document.querySelectorAll('.channel-list');
  const saveButton = document.getElementById('save-channel-order-btn');
  let draggedItem = null;

  const startDrag = (e) => {
    draggedItem = e.target.closest('.channel-item');
    if (!draggedItem) return;
    setTimeout(() => {
      if (draggedItem) draggedItem.classList.add('dragging');
    }, 0);
    if (saveButton) saveButton.style.display = 'inline-block';
  };

  const endDrag = () => {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
    }
    const activeDraggable = document.querySelector('.channel-item[draggable="true"]');
    if (activeDraggable) {
      activeDraggable.removeAttribute('draggable');
    }
    draggedItem = null;
  };

  const moveDrag = (e) => {
    if (!draggedItem) return;
    e.preventDefault();
    const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    if (!y) return;

    const container = draggedItem.closest('.channel-list');
    const afterElement = getDragAfterElement(container, y, '.channel-item');
    if (afterElement === null) {
      container.appendChild(draggedItem);
    } else {
      container.insertBefore(draggedItem, afterElement);
    }
  };

  containers.forEach((container) => {
    // MOUSE
    container.addEventListener('dragstart', startDrag);
    container.addEventListener('dragend', endDrag);
    container.addEventListener('dragover', moveDrag);
    container.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('drag-handle')) {
        const item = e.target.closest('.channel-item');
        if (item) item.setAttribute('draggable', 'true');
      }
    });

    // TOUCH
    container.addEventListener(
      'touchstart',
      (e) => {
        if (e.target.classList.contains('drag-handle')) {
          const item = e.target.closest('.channel-item');
          item.setAttribute('draggable', 'true');
          startDrag({ target: item });
        }
      },
      { passive: true }
    );
    container.addEventListener('touchend', endDrag);
    container.addEventListener('touchmove', moveDrag, { passive: false });
  });

  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      const positions = [];
      document.querySelectorAll('.channel-item').forEach((item) => {
        const categoryId = item.closest('.channel-category-container').dataset.categoryId;
        positions.push({
          id: item.dataset.channelId,
          parentId: categoryId !== 'null' ? categoryId : null,
        });
      });

      const result = await fetchApi(`/api/guilds/${guildId}/channels/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
      });

      if (result) {
        showToast('チャンネルの順序を保存しました。');
        saveButton.style.display = 'none';
        // A full re-fetch and re-render is the most reliable way to reflect the new order.
        const channels = await fetchApi(`/api/guilds/${guildId}/channels-detailed`);
        if (channels) {
          renderChannelManager(guildId, channels);
        }
      }
    });
  }
}

async function openChannelModal(guildId, channelId, allChannels) {
  const isEdit = channelId !== null;
  const channel = isEdit ? allChannels.find((c) => c.id === channelId) : null;
  const roles = currentGuildData.roles;

  const modalHtml = `
    <div id="channel-modal-overlay" class="modal-overlay active">
        <div class="modal-content">
            <h3>${isEdit ? 'チャンネルを編集' : '新規チャンネル作成'}</h3>
            <form id="channel-form">
                <div class="form-group">
                    <label for="channel-name">チャンネル名</label>
                    <input type="text" id="channel-name" value="${channel ? channel.name : ''}" required>
                </div>
                <div class="form-group">
                    <label for="channel-type">チャンネルタイプ</label>
                    <select id="channel-type" ${isEdit ? 'disabled' : ''}>
                        <option value="0" ${channel && channel.type === 0 ? 'selected' : ''}>テキスト</option>
                        <option value="2" ${channel && channel.type === 2 ? 'selected' : ''}>ボイス</option>
                        <option value="4" ${channel && channel.type === 4 ? 'selected' : ''}>カテゴリ</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="channel-category">カテゴリ</label>
                    <select id="channel-category">
                        <option value="">なし</option>
                        ${allChannels
                          .filter((c) => c.type === 4)
                          .map(
                            (c) =>
                              `<option value="${c.id}" ${channel && channel.parentId === c.id ? 'selected' : ''}>${c.name}</option>`
                          )
                          .join('')}
                    </select>
                </div>
                <h4>権限の上書き</h4>
                <div id="permission-overwrites-container"></div>
                <button type="button" id="add-overwrite-btn" class="btn-secondary">上書きを追加</button>
                <div class="modal-footer">
                    <button type="button" id="cancel-channel-edit" class="btn-secondary">キャンセル</button>
                    <button type="submit" class="btn-primary">保存</button>
                </div>
            </form>
        </div>
    </div>
    `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Populate permission overwrites
  const overwritesContainer = document.getElementById('permission-overwrites-container');
  if (isEdit) {
    channel.permissionOverwrites.forEach((ow) => renderPermissionOverwrite(ow, roles));
  }

  document.getElementById('add-overwrite-btn').addEventListener('click', () => {
    // Logic to add a new overwrite UI
  });

  document.getElementById('channel-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'channel-modal-overlay' || e.target.id === 'cancel-channel-edit') {
      document.getElementById('channel-modal-overlay').remove();
    }
  });

  document.getElementById('channel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('channel-name').value,
      type: parseInt(document.getElementById('channel-type').value, 10),
      parentId: document.getElementById('channel-category').value || null,
      // permissionOverwrites: ...
    };

    const url = isEdit
      ? `/api/guilds/${guildId}/channels/${channelId}`
      : `/api/guilds/${guildId}/channels`;
    const method = isEdit ? 'PATCH' : 'POST';

    const result = await fetchApi(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (result) {
      showToast(`チャンネルを${isEdit ? '更新' : '作成'}しました。`);
      document.getElementById('channel-modal-overlay').remove();
      attachChannelManagementListeners();
    }
  });
}

function renderPermissionOverwrite(overwrite, roles) {
  const container = document.getElementById('permission-overwrites-container');
  const target = roles.find((r) => r.id === overwrite.id);
  if (!target) return; // Or handle members

  const overwriteEl = document.createElement('div');
  overwriteEl.className = 'permission-overwrite-grid';
  overwriteEl.innerHTML = `
        <span>${target.name}</span>
        <div>...</div> // UI for permissions
        <button class="btn-danger btn-sm">削除</button>
    `;
  container.appendChild(overwriteEl);
}

async function deleteChannel(guildId, channelId, channelName) {
  if (!confirm(`本当にチャンネル「${channelName}」を削除しますか？`)) return;
  const result = await fetchApi(`/api/guilds/${guildId}/channels/${channelId}`, {
    method: 'DELETE',
  });
  if (result) {
    showToast('チャンネルを削除しました。');
    attachChannelManagementListeners();
  }
}

async function openMemberManager(guildId) {
  showView('guild-view');
  serverInfoContainer.innerHTML = '';
  commandContainer.innerHTML = getMemberManagementPaneHTML();
  attachMemberManagementListeners();
}

async function openRoleManager(guildId) {
  showView('guild-view');
  serverInfoContainer.innerHTML = '';
  commandContainer.innerHTML = `
        <div class="management-section">
            <h3>ロール管理</h3>
            <div id="role-manager-wrapper"></div>
        </div>
    `;

  const roles = await fetchApi(`/api/guilds/${guildId}/roles`);
  if (!roles) {
    commandContainer.innerHTML = '<p>ロールの読み込みに失敗しました。</p>';
    return;
  }

  renderRoleUI(guildId, roles);
}

function renderRoleUI(guildId, roles) {
  const wrapper = document.getElementById('role-manager-wrapper');
  wrapper.innerHTML = `
        <div class="role-manager-container">
            <div class="role-list-sidebar">
                <button id="add-role-btn" class="btn-success" style="width: 100%; margin-bottom: 10px;">新規ロール作成</button>
                <div id="role-order-actions" style="display: none; gap: 10px; margin-bottom: 10px;">
                    <button id="save-role-order-btn" class="btn-success" style="flex-grow: 1;">順序を保存</button>
                    <button id="reset-role-order-btn" class="btn-secondary" style="flex-grow: 1;">リセット</button>
                </div>
                <div id="role-list-container">
                    ${roles
                      .map(
                        (role) => `
                        <div class="role-list-item" data-role-id="${role.id}">
                            <span class="drag-handle" style="cursor: grab; touch-action: none;">⠿</span>
                            <span class="role-color-dot" style="background-color: ${role.color};"></span>
                            <span class="role-name">${role.name}</span>
                            <div class="role-actions">
                                <button class="btn-primary btn-sm" onclick="openRoleModal('${guildId}', '${role.id}')">編集</button>
                                <button class="btn-danger btn-sm" onclick="deleteRole('${guildId}', '${role.id}', '${role.name}')">削除</button>
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
        </div>
    `;

  document
    .getElementById('add-role-btn')
    .addEventListener('click', () => openRoleModal(guildId, null, roles));
  makeRolesDraggable(guildId, roles);
}

function makeRolesDraggable(guildId, originalRoles) {
  const container = document.getElementById('role-list-container');
  const roleOrderActions = document.getElementById('role-order-actions');
  let draggedItem = null;

  const startDrag = (e) => {
    draggedItem = e.target.closest('.role-list-item');
    if (!draggedItem) return;

    setTimeout(() => {
      if (draggedItem) draggedItem.classList.add('dragging');
    }, 0);

    roleOrderActions.style.display = 'flex';
  };

  const endDrag = () => {
    if (!draggedItem) return;
    draggedItem.classList.remove('dragging');

    const activeDraggable = container.querySelector('.role-list-item[draggable="true"]');
    if (activeDraggable) {
      activeDraggable.removeAttribute('draggable');
    }

    draggedItem = null;
  };

  const moveDrag = (e) => {
    if (!draggedItem) return;
    e.preventDefault();

    const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    if (!y) return;

    const afterElement = getDragAfterElement(container, y, '.role-list-item');
    if (afterElement === null) {
      container.appendChild(draggedItem);
    } else {
      container.insertBefore(draggedItem, afterElement);
    }
  };

  // --- Event Listeners ---

  // For MOUSE drag-and-drop
  container.addEventListener('dragstart', startDrag);
  container.addEventListener('dragend', endDrag);
  container.addEventListener('dragover', moveDrag);

  container.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('drag-handle')) {
      e.target.closest('.role-list-item').setAttribute('draggable', 'true');
    }
  });
  container.addEventListener('mouseup', () => {
    const draggableItem = container.querySelector('[draggable="true"]');
    if (draggableItem) {
      setTimeout(() => draggableItem.removeAttribute('draggable'), 50);
    }
  });

  // For TOUCH drag-and-drop
  container.addEventListener(
    'touchstart',
    (e) => {
      if (e.target.classList.contains('drag-handle')) {
        e.preventDefault();
        startDrag(e);
      }
    },
    { passive: false }
  );

  container.addEventListener('touchend', endDrag);
  container.addEventListener('touchmove', moveDrag, { passive: false });

  // --- Action Button Listeners ---
  document.getElementById('save-role-order-btn').addEventListener('click', async () => {
    const roleIds = Array.from(container.querySelectorAll('.role-list-item')).map(
      (card) => card.dataset.roleId
    );
    const result = await fetchApi(`/api/guilds/${guildId}/roles/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: roleIds }),
    });
    if (result) {
      showToast('ロールの順序を保存しました。');
      roleOrderActions.style.display = 'none';
      openRoleManager(guildId);
    }
  });

  document.getElementById('reset-role-order-btn').addEventListener('click', () => {
    renderRoleUI(guildId, originalRoles);
  });
}

async function openRoleModal(guildId, roleId = null) {
  const isEdit = roleId !== null;
  let role = null;
  if (isEdit) {
    const roles = await fetchApi(`/api/guilds/${guildId}/roles`);
    role = roles.find((r) => r.id === roleId);
  }

  const modalHtml = `
        <div id="role-modal-overlay" class="modal-overlay active">
            <div class="modal-content">
                <h3>${isEdit ? 'ロールを編集' : '新規ロール作成'}</h3>
                <form id="role-form">
                    <div class="form-group">
                        <label for="role-name">ロール名</label>
                        <input type="text" id="role-name" value="${role ? role.name : ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="role-color">色</label>
                        <input type="color" id="role-color" value="${role ? role.color : '#99aab5'}">
                    </div>
                    <h4>権限</h4>
                    <div class="permissions-grid">
                        ${Object.keys(permissionTranslations)
                          .map(
                            (perm) => `
                            <div class="permission-checkbox">
                                <input type="checkbox" id="perm-${perm}" name="${perm}" ${role && role.permissions.includes(perm) ? 'checked' : ''}>
                                <label for="perm-${perm}">${permissionTranslations[perm]}</label>
                            </div>
                        `
                          )
                          .join('')}
                    </div>
                    <div class="modal-footer">
                        <button type="button" id="cancel-role-edit" class="btn-secondary">キャンセル</button>
                        <button type="submit" class="btn-primary">保存</button>
                    </div>
                </form>
            </div>
        </div>
    `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('role-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'role-modal-overlay' || e.target.id === 'cancel-role-edit') {
      document.getElementById('role-modal-overlay').remove();
    }
  });

  document.getElementById('role-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('role-name').value;
    const color = document.getElementById('role-color').value;
    const permissions = Array.from(
      document.querySelectorAll('.permission-checkbox input:checked')
    ).map((cb) => cb.name);

    const url = isEdit ? `/api/guilds/${guildId}/roles/${roleId}` : `/api/guilds/${guildId}/roles`;
    const method = isEdit ? 'PATCH' : 'POST';

    const result = await fetchApi(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, permissions }),
    });

    if (result) {
      showToast(`ロールを${isEdit ? '更新' : '作成'}しました。`);
      document.getElementById('role-modal-overlay').remove();
      openRoleManager(guildId);
    }
  });
}

async function deleteRole(guildId, roleId, roleName) {
  if (!confirm(`本当にロール「${roleName}」を削除しますか？`)) return;
  const result = await fetchApi(`/api/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' });
  if (result) {
    showToast(`ロール「${roleName}」を削除しました。`);
    openRoleManager(guildId);
  }
}

// --- WebSocket & Toast ---
function connectWebSocket() {
  const protocol = window.location.protocol === 'https' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${window.location.host}`);
  ws.onopen = () => {
    console.log('[WebSocket] Connection established.');
  };
  ws.onclose = () => {
    console.log('[WebSocket] Connection closed. Reconnecting in 5s...');
    setTimeout(connectWebSocket, 5000);
  };
  ws.onerror = (err) => {
    console.error('[WebSocket] Error:', err);
  };
  ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);

    if (type === 'NEW_MESSAGE') {
      // Check if the message is for the currently active channel
      const currentChannelId = chatHeader.dataset.channelId;
      if (currentChannelId && data.channelId === currentChannelId) {
        const isScrolledToBottom =
          chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 5;

        renderMessages([data], { append: true });

        if (isScrolledToBottom) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // If we thought there were no more new messages, this proves us wrong.
        noMoreNewerMessages = false;
      }
    } else if (type === 'CI_CD_LOG') {
      // UI animation added: Handle CI/CD logs
      const cicdLogContainer = document.getElementById('cicd-log-container');
      if (cicdLogContainer) {
        const isScrolledToBottom =
          cicdLogContainer.scrollHeight - cicdLogContainer.clientHeight <=
          cicdLogContainer.scrollTop + 5;
        cicdLogContainer.textContent += data;
        if (isScrolledToBottom) {
          cicdLogContainer.scrollTop = cicdLogContainer.scrollHeight;
        }
      }
    } else {
      const entry = document.createElement('div');
      entry.className = `log-entry ${type}`;
      entry.textContent = data;
      const isLogScrolledToBottom =
        logContainer.scrollHeight - logContainer.clientHeight <= logContainer.scrollTop + 5;
      logContainer.appendChild(entry);
      if (isLogScrolledToBottom) logContainer.scrollTop = logContainer.scrollHeight;
    }
  };
}

function showToast(message, isError = false) {
  // UI animation added
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '-100px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: isError ? 'var(--danger-color)' : 'var(--success-color)',
    color: 'white',
    padding: '12px 24px',
    borderRadius: 'var(--border-radius)',
    zIndex: '1001',
    boxShadow: 'var(--shadow-lg)',
    fontWeight: '600',
    transition: 'bottom 0.5s ease-in-out',
  });
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.bottom = '20px';
  }, 100);

  setTimeout(() => {
    toast.style.bottom = '-100px';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// --- Pane HTML & Listeners (Backup, etc.) ---
function getBackupPaneHTML() {
  return `
        <div class="info-grid">
            <div class="management-section">
                <h3>新規バックアップ作成</h3>
                <form id="backup-create-form"><div class="form-group"><label for="backup-name">バックアップ名</label><input type="text" id="backup-name" placeholder="例: my-backup-2025" required></div><div class="form-group"><input type="checkbox" id="backup-messages" name="backup-messages" checked><label for="backup-messages" style="display:inline; margin-left: 8px;">メッセージもバックアップする</label></div><button type="submit" class="btn-primary">作成実行</button></form>
            </div>
            <div class="management-section">
                <h3>バックアップから復元</h3>
                <div class="restore-tabs" style="margin-bottom: 1em; border-bottom: 1px solid var(--background-tertiary); padding-bottom: 10px;"><button class="tab-button active" data-restore-type="manual">手動</button><button class="tab-button" data-restore-type="auto">自動</button></div>
                <form id="restore-form"><div class="form-group"><label for="restore-file-select">バックアップファイル</label><select id="restore-file-select" required><option value="" disabled selected>復元するバックアップを選択...</option></select></div><button type="submit" class="btn-danger">復元実行</button></form>
            </div>
        </div>
        <div class="management-section" style="margin-top: 1.5em;">
            <h3>既存のバックアップ</h3>
            <div class="backup-tabs" style="margin-bottom: 1em; border-bottom: 1px solid var(--background-tertiary); padding-bottom: 10px;"><button class="tab-button active" data-backup-type="manual">手動</button><button class="tab-button" data-backup-type="auto">自動</button></div>
            <table id="backups-table"><thead><tr><th>ファイル名</th><th>作成日時</th><th>状態</th><th>操作</th></tr></thead><tbody></tbody></table>
        </div>
        <div class="management-section" style="margin-top: 1.5em;">
            <h3>自動バックアップ設定</h3>
            <form id="schedule-add-form"><div class="form-group" style="display: flex; gap: 1em; align-items: flex-end; flex-wrap: wrap;"><div style="flex-grow: 1; min-width: 120px;"><label for="schedule-day">曜日</label><select id="schedule-day"><option value="*">毎日</option><option value="0">日</option><option value="1">月</option><option value="2">火</option><option value="3">水</option><option value="4">木</option><option value="5">金</option><option value="6">土</option></select></div><div style="flex-grow: 1; min-width: 80px;"><label for="schedule-hour">時</label><input type="number" id="schedule-hour" min="0" max="23" required placeholder="0-23"></div><div style="flex-grow: 1; min-width: 80px;"><label for="schedule-minute">分</label><input type="number" id="schedule-minute" min="0" max="59" required placeholder="0-59"></div><button type="submit" class="btn-primary">スケジュール追加</button></div></form>
            <table id="schedules-table"><thead><tr><th>スケジュール (分 時 * * 曜日)</th><th>次回実行日時</th><th>操作</th></tr></thead><tbody></tbody></table>
        </div>`;
}

function attachBackupListeners() {
  const guildId = currentGuildData.id;
  document.querySelectorAll('.backup-tabs .tab-button').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelector('.backup-tabs .tab-button.active').classList.remove('active');
      b.classList.add('active');
      fetchBackups(guildId, b.dataset.backupType);
    })
  );
  document.querySelectorAll('.restore-tabs .tab-button').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelector('.restore-tabs .tab-button.active').classList.remove('active');
      b.classList.add('active');
      fetchRestoreOptions(guildId, b.dataset.restoreType);
    })
  );
  document.getElementById('backup-create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetchApi(`/api/guilds/${guildId}/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backupName: document.getElementById('backup-name').value,
        backupMessages: document.getElementById('backup-messages').checked,
      }),
    });
    if (res) {
      showToast('バックアップ作成を開始しました。');
      fetchBackups(guildId, 'manual');
      fetchRestoreOptions(guildId, 'manual');
    }
  });
  document.getElementById('restore-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileName = document.getElementById('restore-file-select').value;
    if (!fileName) return showToast('復元するバックアップを選択してください。', true);
    if (!confirm(`本当にサーバーをバックアップ「${fileName}」から復元しますか？`)) return;
    const res = await fetchApi(`/api/guilds/${guildId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    if (res) showToast(`バックアップ「${fileName}」からの復元を開始しました。`);
  });
  document.getElementById('schedule-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cronTime = `${document.getElementById('schedule-minute').value} ${document.getElementById('schedule-hour').value} * * ${document.getElementById('schedule-day').value}`;
    const res = await fetchApi(`/api/guilds/${guildId}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cronTime }),
    });
    if (res) {
      showToast('スケジュールを追加しました。');
      fetchSchedules(guildId);
    }
  });
  fetchBackups(guildId, 'manual');
  fetchSchedules(guildId);
  fetchRestoreOptions(guildId, 'manual');
}

async function fetchBackups(guildId, type) {
  const backups = await fetchApi(`/api/backups?guildId=${guildId}&type=${type}`);
  const tableBody = document.getElementById('backups-table').querySelector('tbody');
  if (!backups)
    return (tableBody.innerHTML =
      '<tr><td colspan="4">バックアップの読み込みに失敗しました。</td></tr>');
  tableBody.innerHTML =
    backups.length === 0
      ? '<tr><td colspan="4">バックアップはありません。</td></tr>'
      : backups
          .map(
            (b) =>
              `<tr><td>${b.fileName}</td><td>${new Date(b.createdAt).toLocaleString()}</td><td style="font-weight:600; color: ${b.locked ? 'var(--warning-color)' : 'var(--success-color)'};">${b.locked ? 'ロック中' : '利用可能'}</td><td><button class="btn-danger" onclick="performBackupAction('${guildId}', 'delete', '${b.userId}', '${b.fileName}', '${type}')">削除</button><button class="btn-warning" onclick="performBackupAction('${guildId}', '${b.locked ? 'unlock' : 'lock'}', '${b.userId}', '${b.fileName}', '${type}')">${b.locked ? 'ロック解除' : 'ロック'}</button></td></tr>`
          )
          .join('');
}

async function fetchRestoreOptions(guildId, type) {
  const backups = await fetchApi(`/api/backups?guildId=${guildId}&type=${type}`);
  const restoreSelect = document.getElementById('restore-file-select');
  if (!backups)
    return (restoreSelect.innerHTML =
      '<option value="" disabled selected>リストの読込失敗</option>');
  restoreSelect.innerHTML =
    '<option value="" disabled selected>復元するバックアップを選択...</option>';
  backups.forEach((b) => {
    const option = document.createElement('option');
    option.value = b.fileName;
    option.textContent = `${b.fileName} (${new Date(b.createdAt).toLocaleString()}) ${b.locked ? ' (ロック中)' : ''}`;
    option.disabled = b.locked;
    restoreSelect.appendChild(option);
  });
}

async function performBackupAction(guildId, action, userId, fileName, type) {
  if (action === 'delete' && !confirm(`本当にバックアップ「${fileName}」を削除しますか？`)) return;
  const result = await fetchApi('/api/backups/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, userId, fileName }),
  });
  if (result) {
    showToast(`バックアップ「${fileName}」を${action}しました。`);
    fetchBackups(guildId, type);
    const restoreType = document.querySelector('.restore-tabs .tab-button.active').dataset
      .restoreType;
    fetchRestoreOptions(guildId, restoreType);
  }
}

async function fetchSchedules(guildId) {
  const schedules = await fetchApi(`/api/guilds/${guildId}/schedules`);
  const tableBody = document.getElementById('schedules-table').querySelector('tbody');
  if (!schedules)
    return (tableBody.innerHTML =
      '<tr><td colspan="3">スケジュールの読み込みに失敗しました。</td></tr>');
  tableBody.innerHTML =
    schedules.length === 0
      ? '<tr><td colspan="3">スケジュールはありません。</td></tr>'
      : schedules
          .map(
            (s) =>
              `<tr><td><code>${s.cronTime}</code></td><td>${new Date(s.nextRun).toLocaleString()}</td><td><button class="btn-danger" onclick="deleteSchedule('${guildId}', '${s.cronTime}')">削除</button></td></tr>`
          )
          .join('');
}

async function deleteSchedule(guildId, cronTime) {
  if (!confirm(`本当にスケジュール「${cronTime}」を削除しますか？`)) return;
  const result = await fetchApi(`/api/guilds/${guildId}/schedules`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cronTime }),
  });
  if (result) {
    showToast('スケジュールを削除しました。');
    fetchSchedules(guildId);
  }
}

function getReactionRolePaneHTML() {
  const { channels, roles } = currentGuildData;
  const textChannels = channels.filter((c) => c.type === 0);
  return `
        <div class="management-section">
            <h3>リアクションロール作成</h3>
            <form id="reaction-role-form">
                <div class="form-group"><label for="rr-channel-id">チャンネル</label><select id="rr-channel-id" required>${textChannels.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <div class="form-group"><label for="rr-message-content">メッセージ内容 (Embed)</label><textarea id="rr-message-content" rows="4" required></textarea></div>
                <div id="rr-pairs-container" style="display: flex; flex-direction: column; gap: 1em;"></div>
                <div style="margin-top: 1.5em;"><button type="button" id="add-rr-pair-btn" class="btn-success" style="margin-right: 10px;">ペアを追加</button><button type="submit" class="btn-primary">作成</button></div>
            </form>
        </div>`;
}

function attachReactionRoleListeners() {
  const guildId = currentGuildData.id;
  const roles = currentGuildData.roles;
  const pairsContainer = document.getElementById('rr-pairs-container');
  const addPair = () => {
    const div = document.createElement('div');
    div.className = 'rr-pair-group';
    div.style.cssText =
      'display: flex; gap: 1em; align-items: center; border: 1px solid var(--background-tertiary); padding: 1em; border-radius: var(--border-radius);';
    div.innerHTML = `<div style="flex: 1;"><label>絵文字</label><input type="text" class="rr-emoji" placeholder="例: 👍" required></div><div style="flex: 2;"><label>ロール</label><select class="rr-role-id" required>${roles.map((r) => `<option value="${r.id}">${r.name}</option>`).join('')}</select></div><button type="button" class="btn-danger remove-rr-pair-btn" style="align-self: flex-end;">削除</button>`;
    pairsContainer.appendChild(div);
    div.querySelector('.remove-rr-pair-btn').addEventListener('click', () => div.remove());
  };
  document.getElementById('add-rr-pair-btn').addEventListener('click', addPair);
  document.getElementById('reaction-role-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      channelId: document.getElementById('rr-channel-id').value,
      messageContent: document.getElementById('rr-message-content').value,
      emojis: Array.from(document.querySelectorAll('.rr-emoji')).map((i) => i.value),
      roleIds: Array.from(document.querySelectorAll('.rr-role-id')).map((s) => s.value),
    };
    if (body.emojis.length === 0)
      return showToast('少なくとも1つの絵文字とロールのペアを追加してください。', true);
    const result = await fetchApi(`/api/guilds/${guildId}/reaction-roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (result) showToast('リアクションロールを作成しました。');
  });
  addPair();
}

function getNgWordPaneHTML() {
  return `
        <div class="management-section"><h3>NGワード管理</h3><form id="ngword-add-form"><div class="form-group"><label for="ngword-input">NGワード追加</label><input type="text" id="ngword-input" placeholder="NGワードを入力" required></div><button type="submit" class="btn-primary">追加</button></form></div>
        <div class="management-section" style="margin-top: 1.5em;"><h3>現在のNGワードリスト</h3><table id="ngwords-table"><thead><tr><th>ワード</th><th>操作</th></tr></thead><tbody></tbody></table></div>`;
}

function attachNgWordListeners() {
  const guildId = currentGuildData.id;
  document.getElementById('ngword-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('ngword-input');
    const result = await fetchApi(`/api/guilds/${guildId}/ngwords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: input.value }),
    });
    if (result) {
      showToast(`NGワード「${input.value}」を追加しました。`);
      input.value = '';
      fetchNgWords(guildId);
    }
  });
  fetchNgWords(guildId);
}

async function fetchNgWords(guildId) {
  const words = await fetchApi(`/api/guilds/${guildId}/ngwords`);
  const tableBody = document.getElementById('ngwords-table').querySelector('tbody');
  if (!words)
    return (tableBody.innerHTML =
      '<tr><td colspan="2">NGワードの読み込みに失敗しました。</td></tr>');
  tableBody.innerHTML =
    words.length === 0
      ? '<tr><td colspan="2">NGワードはありません。</td></tr>'
      : words
          .map(
            (word) =>
              `<tr><td>${word}</td><td><button class="btn-danger" onclick="deleteNgWord('${guildId}', '${encodeURIComponent(word)}')">削除</button></td></tr>`
          )
          .join('');
}

async function deleteNgWord(guildId, word) {
  if (!confirm(`本当にNGワード「${decodeURIComponent(word)}」を削除しますか？`)) return;
  const result = await fetchApi(`/api/guilds/${guildId}/ngwords/${word}`, { method: 'DELETE' });
  if (result) {
    showToast('NGワードを削除しました。');
    fetchNgWords(guildId);
  }
}

function getDeleteMessagePaneHTML() {
  const { channels } = currentGuildData;
  const textChannels = channels.filter((c) => c.type === 0);
  return `
        <div class="management-section">
            <h3>メッセージ一括削除</h3>
            <form id="delete-message-form">
                <div class="form-group"><label for="dm-channel-id">チャンネル</label><select id="dm-channel-id" required>${textChannels.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <div class="form-group"><label for="dm-user-id">対象ユーザー (任意)</label><input type="text" id="dm-user-id" placeholder="ユーザーIDまたは名前で絞り込み"></div>
                <div class="form-group"><label for="dm-count">削除するメッセージ件数 (最大100件)</label><input type="number" id="dm-count" min="1" max="100" value="50" required></div>
                <button type="submit" class="btn-danger">削除実行</button>
            </form>
        </div>`;
}

function attachDeleteMessageListeners() {
  const guildId = currentGuildData.id;
  document.getElementById('delete-message-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const result = await fetchApi(`/api/guilds/${guildId}/deletemessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: document.getElementById('dm-channel-id').value,
        userIdentifier: document.getElementById('dm-user-id').value,
        count: parseInt(document.getElementById('dm-count').value, 10),
      }),
    });
    if (result) showToast(result.message);
  });
}

// --- Initial Load ---
// UI animation added
$(window).on('load', function () {
  $('#page-loader').fadeOut(500, function () {
    $(this).remove();
  });
});

document.addEventListener('DOMContentLoaded', initializeDashboard);
document.addEventListener('click', function (event) {
  if (event.target.matches('.channel-category-name')) {
    const categoryId = event.target.dataset.categoryId;
    const list = document.getElementById(`channel-list-${categoryId}`);
    const icon = event.target.querySelector('svg');
    if (list) {
      const isVisible = list.style.display === 'block';
      list.style.display = isVisible ? 'none' : 'block';
      icon.style.transform = isVisible ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
  }
});

function getMemberManagementPaneHTML() {
  return `
        <div class="management-section">
            <h3>メンバー管理</h3>
            <div class="form-group">
                <label for="member-search">メンバー検索</label>
                <input type="text" id="member-search" placeholder="名前またはIDで検索...">
            </div>
            <div class="member-management-grid">
                <div id="member-list-container" class="member-list-container">
                    <p>メンバーを検索または読み込んでください。</p>
                </div>
                <div id="member-info-container" class="member-info-container">
                    <p>メンバーを選択すると詳細が表示されます。</p>
                </div>
            </div>
        </div>
    `;
}

function attachMemberManagementListeners() {
  const guildId = currentGuildData.id;
  const searchInput = document.getElementById('member-search');

  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchMembers(guildId, searchInput.value);
    }, 300);
  });

  fetchMembers(guildId, '');
}

async function fetchMembers(guildId, query) {
  const memberListContainer = document.getElementById('member-list-container');
  memberListContainer.innerHTML = '<p>読み込み中...</p>';
  const members = await fetchApi(`/api/guilds/${guildId}/users?q=${encodeURIComponent(query)}`);

  if (members && members.length > 0) {
    memberListContainer.innerHTML = members
      .map(
        (member) => `
            <div class="member-list-item" data-member-id="${member.id}">
                <img src="${member.avatarURL}" alt="${member.username}" class="member-avatar">
                <div>
                    <strong>${member.username}</strong>
                    <small style="display: block; color: var(--text-muted);">${member.id}</small>
                </div>
            </div>
        `
      )
      .join('');

    memberListContainer.querySelectorAll('.member-list-item').forEach((item) => {
      item.addEventListener('click', () => {
        memberListContainer
          .querySelectorAll('.member-list-item')
          .forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        fetchMemberDetails(guildId, item.dataset.memberId);
      });
    });
  } else {
    memberListContainer.innerHTML = '<p>メンバーが見つかりません。</p>';
  }
}

async function fetchMemberDetails(guildId, memberId) {
  const memberInfoContainer = document.getElementById('member-info-container');
  memberInfoContainer.innerHTML = '<p>詳細を読み込み中...</p>';
  const member = await fetchApi(`/api/guilds/${guildId}/members/${memberId}`);

  if (member) {
    const allRoles = currentGuildData.roles;
    memberInfoContainer.innerHTML = `
            <div class="member-header">
                <img src="${member.avatarURL}" alt="${member.username}" class="member-avatar" style="width: 60px; height: 60px;">
                <h3>${member.username}</h3>
            </div>
            <div class="form-group">
                <label for="member-nickname">ニックネーム</label>
                <input type="text" id="member-nickname" value="${member.nickname || ''}" placeholder="ニックネーム未設定">
                <button id="save-nickname-btn" class="btn-primary" style="margin-top: 10px;">ニックネームを保存</button>
            </div>
            <div class="form-group">
                <label>ロール</label>
                <div id="member-roles-container" class="role-management-pills">
                    ${member.roles
                      .map((roleId) => {
                        const role = allRoles.find((r) => r.id === roleId);
                        if (!role) return '';
                        const isEveryoneRole = role.id === guildId;
                        const removeButton = !isEveryoneRole
                          ? `<button class="remove-role-btn" data-role-id="${role.id}">×</button>`
                          : '';
                        const bgColor = role.color === '#000000' ? '#99aab5' : role.color;
                        const textColor = getContrastingTextColor(bgColor); // UI animation added
                        return `<span class="role-pill-management" style="background-color: ${bgColor}; color: ${textColor};">${role.name} ${removeButton}</span>`;
                      })
                      .join('')}
                </div>
                <div style="margin-top: 10px;">
                    <select id="add-role-select">
                        <option value="">ロールを追加...</option>
                        ${allRoles
                          .filter((r) => !member.roles.includes(r.id) && r.id !== guildId)
                          .map((r) => `<option value="${r.id}">${r.name}</option>`)
                          .join('')}
                    </select>
                    <button id="add-role-btn" class="btn-success" style="margin-top: 10px;">ロールを追加</button>
                </div>
            </div>
            <div class="form-group">
                <label>危険ゾーン</label>
                <button id="kick-member-btn" class="btn-warning">メンバーをキック</button>
                <button id="ban-member-btn" class="btn-danger" style="margin-left: 10px;">メンバーをBAN</button>
            </div>
        `;

    // Add event listeners for the new buttons
    document
      .getElementById('save-nickname-btn')
      .addEventListener('click', () => updateMemberNickname(guildId, memberId));
    document
      .getElementById('add-role-btn')
      .addEventListener('click', () => addMemberRole(guildId, memberId));
    document.querySelectorAll('.remove-role-btn').forEach((btn) => {
      btn.addEventListener('click', () => removeMemberRole(guildId, memberId, btn.dataset.roleId));
    });
    document
      .getElementById('kick-member-btn')
      .addEventListener('click', () => kickMember(guildId, memberId));
    document
      .getElementById('ban-member-btn')
      .addEventListener('click', () => banMember(guildId, memberId));
  } else {
    memberInfoContainer.innerHTML = '<p>メンバー詳細の読み込みに失敗しました。</p>';
  }
}

async function updateMemberNickname(guildId, memberId) {
  const nickname = document.getElementById('member-nickname').value;
  const result = await fetchApi(`/api/guilds/${guildId}/members/${memberId}/nickname`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  if (result) {
    showToast('ニックネームを更新しました。');
  }
}

async function addMemberRole(guildId, memberId) {
  const roleId = document.getElementById('add-role-select').value;
  if (!roleId) return;
  const result = await fetchApi(`/api/guilds/${guildId}/members/${memberId}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId }),
  });
  if (result) {
    showToast('ロールを追加しました。');
    fetchMemberDetails(guildId, memberId);
  }
}

async function removeMemberRole(guildId, memberId, roleId) {
  const result = await fetchApi(`/api/guilds/${guildId}/members/${memberId}/roles/${roleId}`, {
    method: 'DELETE',
  });
  if (result) {
    showToast('ロールを削除しました。');
    fetchMemberDetails(guildId, memberId);
  }
}

async function kickMember(guildId, memberId) {
  if (!confirm('本当にこのメンバーをキックしますか？')) return;
  const result = await fetchApi(`/api/guilds/${guildId}/members/${memberId}/kick`, {
    method: 'POST',
  });
  if (result) {
    showToast('メンバーをキックしました。');
    document.getElementById('member-info-container').innerHTML =
      '<p>メンバーがキックされました。リストから再選択してください。</p>';
    fetchMembers(guildId, document.getElementById('member-search').value);
  }
}

async function banMember(guildId, memberId) {
  if (!confirm('本当にこのメンバーをBANしますか？')) return;
  const result = await fetchApi(`/api/guilds/${guildId}/members/${memberId}/ban`, {
    method: 'POST',
  });
  if (result) {
    showToast('メンバーをBANしました。');
    document.getElementById('member-info-container').innerHTML =
      '<p>メンバーがBANされました。リストから再選択してください。</p>';
    fetchMembers(guildId, document.getElementById('member-search').value);
  }
}
