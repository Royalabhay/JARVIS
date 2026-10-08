const $ = (id) => document.getElementById(id);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let pendingAction = null;
let settings = { token: '', language: 'en-IN', voiceReply: true };

function say(text) {
  if (!settings.voiceReply || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = settings.language;
  window.speechSynthesis.speak(utterance);
}

function addLog(title, detail, icon = '↗') {
  const log = $('log');
  if (log.querySelector('.empty-state')) log.innerHTML = '';
  const row = document.createElement('div'); row.className = 'log-row';
  const glyph = document.createElement('span'); glyph.className = 'log-icon'; glyph.textContent = icon;
  const copy = document.createElement('span'); copy.className = 'log-copy';
  const heading = document.createElement('b'); heading.textContent = title;
  const description = document.createElement('small'); description.textContent = detail;
  copy.append(heading, description);
  const time = document.createElement('time'); time.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  row.append(glyph, copy, time); log.prepend(row);
  while (log.children.length > 15) log.lastElementChild.remove();
}

function normalize(value) {
  return value.trim().toLocaleLowerCase().replace(/[.!?।]+$/u, '').replace(/\s+/g, ' ');
}

const SITE_NAMES = 'youtube|google|gmail|whatsapp|instagram|linkedin|github|chatgpt';
function parseCommand(raw) {
  const text = normalize(raw);
  let match = text.match(new RegExp(`^(?:open|kholo|khol do|launch)\\s+(${SITE_NAMES})$`, 'i'));
  if (match) return {type:'open-site', site:match[1].toLowerCase()};
  match = text.match(new RegExp(`^(${SITE_NAMES})\\s+(?:kholo|khol do)$`, 'i'));
  if (match) return {type:'open-site', site:match[1].toLowerCase()};
  match = text.match(/^(?:open|kholo|khol do|launch)\s+(notepad|calculator|calc|explorer|file explorer)$/i);
  if (match) {
    const app = match[1].toLowerCase().replace(/^file\s+/, '').replace(/^calc$/, 'calculator');
    return {type:'desktop', action:`open-${app}`};
  }
  match = text.match(/^(?:search(?:\s+for)?|google|dhundo|dhoondo|search karo|खोजो|ढूंढो)\s+(.+)/iu);
  if (match) return {type:'search', query:match[1].slice(0,240)};
  if (/^(?:next tab|agla tab|अगला टैब|अगला टॅब)$/.test(text)) return {type:'move-tab', direction:1};
  if (/^(?:previous tab|pichhla tab|पिछला टैब)$/.test(text)) return {type:'move-tab', direction:-1};
  if (/^(?:reload|refresh|tab reload karo|page refresh karo|पेज रीलोड करो)$/.test(text)) return {type:'reload'};
  if (/^(?:close tab|tab band karo|tab close karo|टैब बंद करो)$/.test(text)) return {type:'confirm-close'};
  if (/^(?:show desktop|desktop dikhao|desktop dikha do|डेस्कटॉप दिखाओ)$/.test(text)) return {type:'desktop',action:'show-desktop'};
  if (/^(?:switch window|switch app|change window|window badlo|app badlo|window switch karo)$/.test(text)) return {type:'desktop',action:'switch-window'};
  if (/^(?:volume up|sound badhao|awaaz badhao|आवाज़ बढ़ाओ)$/.test(text)) return {type:'desktop',action:'volume-up'};
  if (/^(?:volume down|sound kam karo|awaaz kam karo|आवाज़ कम करो)$/.test(text)) return {type:'desktop',action:'volume-down'};
  if (/^(?:mute|volume mute|awaaz band karo|म्यूट करो)$/.test(text)) return {type:'desktop',action:'volume-mute'};
  if (/^(?:take screenshot|screenshot lo|screenshot|स्क्रीनशॉट लो)$/.test(text)) return {type:'desktop',action:'screenshot'};
  if (/^(?:open task manager|task manager kholo|task manager खोलो)$/.test(text)) return {type:'desktop',action:'task-manager'};
  if (/^(?:lock computer|lock pc|computer lock karo|pc lock karo|कंप्यूटर लॉक करो)$/.test(text)) return {type:'confirm-lock'};
  return null;
}

function requestApproval(action) {
  pendingAction = action;
  const label = action.type === 'confirm-lock' ? 'Lock this Windows computer now?' : 'Close your current Chrome tab?';
  $('approval-text').textContent = label;
  $('confirm').textContent = action.type === 'confirm-lock' ? 'Lock computer' : 'Close tab';
  $('approval').classList.remove('hidden');
  $('confirm').focus();
}

function runCommand(raw) {
  if (!raw.trim()) return;
  $('command').value = raw;
  const action = parseCommand(raw);
  if (!action) {
    addLog('I didn’t catch that', 'Try “open Gmail”, “next tab”, “volume up”, or “show desktop”.', '…');
    say('Sorry, please try a supported command.');
    return;
  }
  if (action.type === 'confirm-close' || action.type === 'confirm-lock') { requestApproval(action); return; }
  sendAction(action);
}

function sendAction(action) {
  chrome.runtime.sendMessage({type:'SARA_ACTION', action}, (result) => {
    if (chrome.runtime.lastError) {
      addLog('Sara connection error', 'Reopen the assistant and try again.', '!'); return;
    }
    if (!result?.ok) {
      addLog('Action needs setup', result?.error || 'Open Settings to connect Sara to this computer.', '!');
      if (result?.code === 'AGENT_OFFLINE' || result?.code === 'NEEDS_SETUP') setConnection(false, result.error);
      say(result?.error || 'Please check Sara settings.');
      return;
    }
    addLog(result.title || 'Done', result.detail || 'Action completed.', result.icon || '✓');
    say(result.spoken || result.title || 'Done.');
    if (action.type === 'confirm-close' || action.type === 'switch-tab') refreshTabs();
  });
}

function setConnection(online, label) {
  const element = $('connection');
  element.classList.toggle('online', online);
  element.classList.toggle('offline', !online);
  element.querySelector('span').textContent = online ? 'DESKTOP READY' : (label ? 'SETUP NEEDED' : 'DESKTOP OFF');
  element.title = label || (online ? 'Sara desktop companion connected' : 'Start the Windows companion to enable desktop actions');
}

function renderTabs(tabs) {
  const list = $('tabs-list');
  $('tab-count').textContent = String(tabs.length);
  if (!tabs.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">▤</span><p>No browser tabs found in this window.</p></div>';
    return;
  }
  list.replaceChildren();
  for (const tab of tabs.slice(0, 20)) {
    const button = document.createElement('button'); button.className = 'tab-row'; button.dataset.tabId = String(tab.id);
    const icon = document.createElement('span'); icon.className = 'tab-favicon'; icon.textContent = tab.active ? '●' : '◉';
    const copy = document.createElement('span'); copy.className = 'tab-copy';
    const title = document.createElement('b'); title.textContent = tab.title || 'Untitled tab';
    const domain = document.createElement('small');
    try { domain.textContent = new URL(tab.url || '').hostname || 'Chrome page'; } catch { domain.textContent = 'Chrome page'; }
    copy.append(title, domain);
    const arrow = document.createElement('span'); arrow.className = 'tab-open'; arrow.textContent = tab.active ? '✓' : '↗';
    button.append(icon, copy, arrow);
    button.addEventListener('click', () => sendAction({type:'switch-tab', tabId:tab.id}));
    list.append(button);
  }
}

function refreshTabs() {
  chrome.runtime.sendMessage({type:'SARA_LIST_TABS'}, (result) => {
    if (chrome.runtime.lastError || !result?.ok) return;
    renderTabs(result.tabs);
  });
}

function setupVoice() {
  if (!Recognition) {
    $('mic-label').textContent = 'Voice unavailable in this Chrome';
    $('heard').textContent = 'Use the command box below instead.';
    $('mic').disabled = true;
    return;
  }
  $('mic').addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const recognition = new Recognition();
    recognition.lang = settings.language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onstart = () => {
      $('mic').classList.add('listening'); $('mic-label').textContent = 'Listening…'; $('heard').textContent = 'Speak your command; recognition ends when you pause.';
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      $('heard').textContent = `Heard: ${transcript}`;
      runCommand(transcript);
    };
    recognition.onerror = (event) => {
      $('mic-label').textContent = event.error === 'not-allowed' ? 'Microphone blocked' : 'Please try again';
      $('heard').textContent = event.error === 'not-allowed' ? 'Allow microphone access in Chrome site settings.' : 'Tap the mic and say a short command.';
    };
    recognition.onend = () => { $('mic').classList.remove('listening'); if ($('mic-label').textContent === 'Listening…') $('mic-label').textContent = 'Tap to speak'; };
    try { recognition.start(); } catch { $('mic-label').textContent = 'Please wait and try again'; }
  });
}

$('send').addEventListener('click', () => runCommand($('command').value));
$('command').addEventListener('keydown', (event) => { if (event.key === 'Enter') runCommand($('command').value); });
document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => runCommand(button.dataset.command)));
$('settings-open').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('refresh-tabs').addEventListener('click', refreshTabs);
$('clear').addEventListener('click', () => { $('log').innerHTML = '<div class="empty-state compact"><p>Your actions will appear here.</p></div>'; });
$('confirm').addEventListener('click', () => { if (!pendingAction) return; const action = pendingAction; pendingAction = null; $('approval').classList.add('hidden'); sendAction(action.type === 'confirm-lock' ? {type:'desktop',action:'lock-computer'} : {type:'close-confirmed'}); });
$('cancel').addEventListener('click', () => { pendingAction = null; $('approval').classList.add('hidden'); addLog('Cancelled', 'No action was taken.', '↩'); });

chrome.storage.local.get(['token','language','voiceReply'], (saved) => {
  settings = {...settings, ...saved};
  $('language').value = settings.language;
  setConnection(false, settings.token ? '' : 'Add the Windows companion token in Settings.');
  setupVoice();
  chrome.runtime.sendMessage({type:'SARA_HEALTH'}, (result) => setConnection(!!result?.ok, result?.error));
  refreshTabs();
});
$('language').addEventListener('change', () => {
  settings.language = $('language').value;
  chrome.storage.local.set({language:settings.language});
});
