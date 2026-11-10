import { supabase, ensureSession } from './supabase.js';
import { themeManager } from './theme.js';

const $ = (sel, root = document) => root.querySelector(sel);

themeManager.init();

let currentUser = null;

// --- ДЕМО-ДАННЫЕ (временные, до шага 5) ---
const demo = {
  server: { id: 's1', name: 'Relay Dev' },
  channels: [
    { id: 'c1', name: 'general', type: 'text' },
    { id: 'c2', name: 'design', type: 'text' },
    { id: 'c3', name: 'voice-lounge', type: 'voice' },
  ],
  activeChannel: 'c1',
  messages: [
    { id: 'm1', author: 'neo', text: 'Каркас на месте, идём дальше.', own: false },
  ],
};

// --- ЗАПУСК ---
async function boot() {
  try {
    currentUser = await ensureSession();
  } catch (err) {
    console.error('[Relay] Не удалось создать сессию:', err);
  }

  renderMePanel();
  renderChannels();
  selectChannel(demo.activeChannel);
  renderMessages();
}

// --- ПРОФИЛЬ В УГЛУ ---
async function renderMePanel() {
  const panel = $('#mePanel');
  if (!currentUser) {
    panel.hidden = true;
    return;
  }

  let profile = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, status')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (data) { profile = data; break; }
    if (error) console.warn('[Relay] profile fetch:', error.message);
    await new Promise(r => setTimeout(r, 300));
  }

  panel.hidden = false;
  const name = panel.querySelector('.me-name');
  const status = panel.querySelector('.me-status');
  const avatar = panel.querySelector('.me-avatar');

  if (profile) {
    name.textContent = profile.display_name || profile.username;
    status.textContent = 'В сети';
    avatar.src = profile.avatar_url
      || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.username)}&backgroundColor=a855f7`;
  } else {
    name.textContent = 'Гость';
    status.textContent = 'В сети';
    avatar.src = `https://api.dicebear.com/7.x/initials/svg?seed=guest&backgroundColor=a855f7`;
  }
}

// --- КАРКАС ---
function renderChannels() {
  const tree = $('#channelTree');
  tree.innerHTML = '';

  const label = document.createElement('div');
  label.className = 'channel-group-label';
  label.textContent = 'Текстовые';
  tree.append(label);

  for (const ch of demo.channels) {
    const el = document.createElement('div');
    el.className = 'channel-item' + (ch.id === demo.activeChannel ? ' active' : '');
    el.dataset.id = ch.id;
    el.innerHTML = `<span class="hash">${ch.type === 'voice' ? '🔊' : '#'}</span>${ch.name}`;
    el.addEventListener('click', () => selectChannel(ch.id));
    tree.append(el);
  }

  $('#serverTitle').textContent = demo.server.name;
}

function selectChannel(id) {
  demo.activeChannel = id;
  const ch = demo.channels.find(c => c.id === id);
  $('#chatHead').textContent = ch ? `# ${ch.name}` : '';
  renderChannels();
}

function renderMessages() {
  const box = $('#messages');
  box.innerHTML = '';

  for (const m of demo.messages) {
    const el = document.createElement('div');
    el.className = `msg ${m.own ? 'own' : 'other'}`;

    const body = document.createElement('div');
    body.className = 'msg-body';
    body.innerHTML = `
      <div class="msg-author"></div>
      <div class="msg-text"></div>
    `;
    body.querySelector('.msg-author').textContent = m.author;
    body.querySelector('.msg-text').textContent = m.text;
    el.append(body);
    box.append(el);
  }

  box.scrollTop = box.scrollHeight;
}

// Отправка (пока локальная, на шаге 5 заменим на Supabase)
$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#composerInput');
  const text = input.value.trim();
  if (!text) return;

  demo.messages.push({
    id: crypto.randomUUID(),
    author: 'you',
    text,
    own: true,
  });
  input.value = '';
  renderMessages();
});

$('#composerInput').addEventListener('input', (e) => {
  const t = e.target;
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, 140) + 'px';
});

// --- МОДАЛКА ТЕМЫ ---
const themeModal = $('#themeModal');
const themePreset = $('#themePreset');
const customControls = $('#customControls');

$('#mePanel')?.addEventListener('click', () => {
  themePreset.value = themeManager.currentTheme;
  customControls.hidden = themeManager.currentTheme !== 'custom';
  themeModal.showModal();
});

themePreset.addEventListener('change', (e) => {
  const val = e.target.value;
  themeManager.apply(val);
  customControls.hidden = val !== 'custom';
});

const bindColor = (id, cssVar, isGradient = false) => {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('input', (e) => {
    let val = e.target.value;
    if (isGradient) {
      val = `radial-gradient(1200px 800px at 20% 10%, ${val}40, transparent 60%), ${val}`;
    }
    themeManager.setCustomVar(cssVar, val);
  });
};

bindColor('colorAccent', '--accent');
bindColor('colorBgChat', '--bg-chat');
bindColor('colorMsgOwn', '--bg-msg-own');
bindColor('colorBgLauncher', '--bg-launcher', true);

$('#btnResetTheme').addEventListener('click', () => {
  themeManager.resetCustom();
  themePreset.value = 'dark';
  customControls.hidden = true;
});
$('#btnExportTheme').addEventListener('click', () => themeManager.exportTheme());
$('#importThemeInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    if (themeManager.importTheme(ev.target.result)) {
      themePreset.value = 'custom';
      customControls.hidden = false;
    } else {
      alert('Не удалось загрузить тему. Проверьте формат JSON.');
    }
  };
  reader.readAsText(file);
});

// Погнали
boot();