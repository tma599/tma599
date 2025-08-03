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
    `<li data-channel-id="${channel.id}" data-channel-name="${channel.name}" class="${
      channel.type === 0 ? 'text-channel' : channel.type === 2 ? 'voice-channel' : ''
    }"><div>${getChannelIcon(channel)} ${channel.name}</div><div class="voice-channel-members" data-channel-id="${channel.id}"></div></li>`;
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
  document.querySelectorAll('.voice-channel').forEach((item) => {
    item.addEventListener('click', () => {
      selectVoiceChannel(guild.id, item.dataset.channelId, item.dataset.channelName);
    });
  });

  // After rendering channels, fetch and render voice members for each voice channel
  allChannels
    .filter((c) => c.type === 2)
    .forEach((vc) => {
      fetchAndRenderVoiceMembers(guild.id, vc.id);
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
    .map(
      (msg) => `
        <div class="chat-message" data-message-id="${msg.id}">
            <img src="${msg.author.avatarURL}" alt="${msg.author.username}" class="chat-avatar">
            <div class="chat-message-content">
                <div class="chat-message-header">
                    <span class="chat-username">${msg.author.username}</span>
                    <span class="chat-timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
                </div>
                <div class="chat-message-body">${msg.content}</div>
            </div>
        </div>
    `
    )
    .join('');

  if (options.isNew) {
    chatMessages.innerHTML = messagesHtml;
  } else if (options.prepend) {
    chatMessages.insertAdjacentHTML('afterbegin', messagesHtml);
  } else {
    // Append by default
    chatMessages.insertAdjacentHTML('beforeend', messagesHtml);
  }
}

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
      // Check if the message is for the currently active channel
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
    } else if (type === 'VOICE_STATE_UPDATE') {
      // Handle voice state updates
      // Re-render voice members for the affected channel
      const currentVoiceChannelId = document.getElementById('voice-view').querySelector('h3')
        .dataset.channelId; // Assuming channelId is stored in h3 dataset
      if (data.channelId === currentVoiceChannelId) {
        fetchAndRenderVoiceMembers(data.guildId, data.channelId);
      }
      // Also update the main channel list if the update is for a voice channel
      const channelListItem = document.querySelector(
        `.voice-channel[data-channel-id="${data.channelId}"]`
      );
      if (channelListItem) {
        fetchAndRenderVoiceMembers(data.guildId, data.channelId);
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
  const { channels } = currentGuildData;
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
                <div class="form-group"><label for="dm-user-id">対象ユーザー (任意)</label><input type="text" id="dm-user-id" placeholder="ユーザーIDまたは名前で絞り込み">
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

// --- Voice Channel Management ---

function generateVoiceControlPanelHTML(channelName) {
  // Using descriptive icons for better UX
  const icons = {
    join: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
    leave:
      '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>',
    mute: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>',
    unmute:
      '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9L19.73 21 21 19.73 4.27 3z"/></svg>',
    deafen:
      '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-2.06c-.33-2.22-1.88-4.03-3.94-4.79V2h-2v2.21C8.88 4.97 7.33 6.78 7.06 9H5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h2.06c.33 2.22 1.88 4.03 3.94 4.79V22h2v-2.21c2.06-.76 3.61-2.57 3.94-4.79H19c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2zm-7 9.5c-2.48 0-4.5-2.02-4.5-4.5S9.52 9.5 12 9.5s4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5z"/></svg>',
    undeafen:
      '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.28 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    stream:
      '<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><g><rect fill="none" height="24" width="24"/></g><g><path d="M21,3H3C1.9,3,1,3.9,1,5v12c0,1.1,0.9,2,2,2h5v2h8v-2h5c1.1,0,1.99-0.9,1.99-2L23,5C23,3.9,22.1,3,21,3z M21,17H3V5h18V17z M14.5,11l2-3l-2-3H13v6H14.5z M9.5,11l2-3l-2-3H8v6H9.5z"/></g></svg>',
    mic: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12,12c2.21,0,4-1.79,4-4V4c0-2.21-1.79-4-4-4S8,1.79,8,4v4C8,10.21,9.79,12,12,12z M17,11c0,2.76-2.24,5-5,5s-5-2.24-5-5H5c0,3.53,2.61,6.43,6,6.92V21h2v-3.08c3.39-0.49,6-3.39,6-6.92H17z"/></svg>',
  };

  return `
    <div class="management-section">
      <div class="voice-channel-header">
        <h3>🔊 ${channelName}</h3>
        <div id="voice-channel-members-panel" class="voice-channel-members"></div>
      </div>
      <div class="voice-control-grid">
        <button id="join-voice-btn" class="voice-control-button btn-success">
          ${icons.join}
          <span>参加</span>
        </button>
        <button id="leave-voice-btn" class="voice-control-button btn-danger">
          ${icons.leave}
          <span>切断</span>
        </button>
        <button id="mute-btn" class="voice-control-button" data-muted="false">
          ${icons.mute}
          <span>ミュート</span>
        </button>
        <button id="deafen-btn" class="voice-control-button" data-deafened="false">
          ${icons.deafen}
          <span>スピーカーミュート</span>
        </button>
      </div>
      <div class="voice-streaming-section">
          <h4>音声ストリーミング (開発中)</h4>
          <div class="voice-control-grid">
              <button id="listen-stream-btn" class="voice-control-button" disabled>
                  ${icons.stream}
                  <span>受信</span>
              </button>
              <button id="talk-stream-btn" class="voice-control-button" disabled>
                  ${icons.mic}
                  <span>送信</span>
              </button>
          </div>
      </div>
    </div>
  `;
}

async function selectVoiceChannel(guildId, channelId, channelName) {
  showView('voice-view');
  const voiceView = document.getElementById('voice-view');
  voiceView.innerHTML = generateVoiceControlPanelHTML(channelName);

  // Fetch bot's current voice state and update UI
  const botVoiceState = await fetchApi(`/api/guilds/${guildId}/bot-voice-state`);
  const joinBtn = document.getElementById('join-voice-btn');
  const leaveBtn = document.getElementById('leave-voice-btn');
  const muteBtn = document.getElementById('mute-btn');
  const deafenBtn = document.getElementById('deafen-btn');

  if (botVoiceState && botVoiceState.inVoiceChannel && botVoiceState.channelId === channelId) {
    joinBtn.disabled = true;
    leaveBtn.disabled = false;

    muteBtn.dataset.muted = botVoiceState.selfMute;
    muteBtn.querySelector('span').textContent = botVoiceState.selfMute
      ? 'ミュート解除'
      : 'ミュート';
    muteBtn.classList.toggle('active', botVoiceState.selfMute);

    deafenBtn.dataset.deafened = botVoiceState.selfDeaf;
    deafenBtn.querySelector('span').textContent = botVoiceState.selfDeaf
      ? 'スピーカーミュート解除'
      : 'スピーカーミュート';
    deafenBtn.classList.toggle('active', botVoiceState.selfDeaf);
  } else {
    joinBtn.disabled = false;
    leaveBtn.disabled = true;
    muteBtn.disabled = true;
    deafenBtn.disabled = true;
  }

  attachVoiceControlListeners(guildId, channelId);
  fetchAndRenderVoiceMembers(guildId, channelId);
}

async function fetchAndRenderVoiceMembers(guildId, channelId) {
  const members = await fetchApi(`/api/guilds/${guildId}/voice-members/${channelId}`);
  if (members) {
    renderVoiceMembers(channelId, members);
  }
}

function renderVoiceMembers(channelId, members) {
  const listContainer = document.querySelector(
    `.voice-channel-members[data-channel-id="${channelId}"]`
  );
  const panelContainer = document.getElementById('voice-channel-members-panel');

  const membersHtml = members
    .map(
      (member) =>
        `<img src="${member.avatarURL}" alt="${member.displayName}" class="member-avatar-small" title="${member.displayName}">`
    )
    .join('');

  if (listContainer) {
    listContainer.innerHTML = membersHtml;
  }
  if (panelContainer) {
    panelContainer.innerHTML = membersHtml;
  }
}

function attachVoiceControlListeners(guildId, channelId) {
  document.getElementById('join-voice-btn').addEventListener('click', async () => {
    const result = await fetchApi(`/api/guilds/${guildId}/voice/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });
    if (result) {
      showToast('ボイスチャンネルに参加しました。');
      // Update UI after successful join
      const joinBtn = document.getElementById('join-voice-btn');
      const leaveBtn = document.getElementById('leave-voice-btn');
      const muteBtn = document.getElementById('mute-btn');
      const deafenBtn = document.getElementById('deafen-btn');

      joinBtn.disabled = true;
      leaveBtn.disabled = false;
      muteBtn.disabled = false;
      deafenBtn.disabled = false;

      // Bot joins muted and undeafened by default
      muteBtn.dataset.muted = 'true';
      muteBtn.querySelector('span').textContent = 'ミュート解除';
      muteBtn.classList.add('active');

      deafenBtn.dataset.deafened = 'false';
      deafenBtn.querySelector('span').textContent = 'スピーカーミュート';
      deafenBtn.classList.remove('active');

      fetchAndRenderVoiceMembers(guildId, channelId);
    }
  });

  document.getElementById('leave-voice-btn').addEventListener('click', async () => {
    const result = await fetchApi(`/api/guilds/${guildId}/voice/leave`, {
      method: 'POST',
    });
    if (result) {
      showToast('ボイスチャンネルから切断しました。');
      // Update UI after successful leave
      const joinBtn = document.getElementById('join-voice-btn');
      const leaveBtn = document.getElementById('leave-voice-btn');
      const muteBtn = document.getElementById('mute-btn');
      const deafenBtn = document.getElementById('deafen-btn');

      joinBtn.disabled = false;
      leaveBtn.disabled = true;
      muteBtn.disabled = true;
      deafenBtn.disabled = true;

      // Clear voice members display
      renderVoiceMembers(channelId, []);
    }
  });

  const muteBtn = document.getElementById('mute-btn');
  muteBtn.addEventListener('click', async () => {
    const isMuted = muteBtn.dataset.muted === 'true';
    const result = await fetchApi(`/api/guilds/${guildId}/voice/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mute: !isMuted }),
    });
    if (result) {
      muteBtn.dataset.muted = !isMuted;
      muteBtn.querySelector('span').textContent = !isMuted ? 'ミュート解除' : 'ミュート';
      muteBtn.classList.toggle('active', !isMuted);
      showToast(!isMuted ? 'ミュートしました。' : 'ミュートを解除しました。');
    }
  });

  const deafenBtn = document.getElementById('deafen-btn');
  deafenBtn.addEventListener('click', async () => {
    const isDeafened = deafenBtn.dataset.deafened === 'true';
    const result = await fetchApi(`/api/guilds/${guildId}/voice/deafen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deafen: !isDeafened }),
    });
    if (result) {
      deafenBtn.dataset.deafened = !isDeafened;
      deafenBtn.querySelector('span').textContent = !isDeafened
        ? 'スピーカーミュート解除'
        : 'スピーカーミュート';
      deafenBtn.classList.toggle('active', !isDeafened);
      showToast(
        !isDeafened ? 'スピーカーミュートしました。' : 'スピーカーミュートを解除しました。'
      );
    }
  });
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
