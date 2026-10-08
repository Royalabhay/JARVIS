const $ = (id) => document.getElementById(id);
const mic = $('mic'), micLabel = $('mic-label'), input = $('command');
let pendingClose = null;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function addLog(title, detail, icon = '↗') {
  const log = $('log');
  if (log.querySelector('.empty')) log.innerHTML = '';
  const row = document.createElement('div'); row.className = 'item';
  const glyph = document.createElement('div'); glyph.className = 'item-icon'; glyph.textContent = icon;
  const body = document.createElement('div'); const heading = document.createElement('b'); heading.textContent = title;
  const description = document.createElement('p'); description.textContent = detail;
  body.append(heading, description); const time = document.createElement('time'); time.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  row.append(glyph, body, time); log.prepend(row);
}
function normalize(text) { return text.trim().replace(/[.!?]+$/,'').toLocaleLowerCase(); }
function parseCommand(raw) {
  const text = normalize(raw);
  const open = text.match(/^(?:(?:open|kholo|khol do|launch)\s+(youtube|google|gmail|whatsapp|instagram|linkedin|github|chatgpt)|(youtube|google|gmail|whatsapp|instagram|linkedin|github|chatgpt)\s+(?:kholo|khol do))$/i);
  if (open) return {type:'open', site:open[1] || open[2]};
  const search = text.match(/^(?:search(?:\s+for)?|google|dhundo|dhoondo|search karo)\s+(.+)/i);
  if (search) return {type:'search', query:search[1]};
  if (/^(?:next tab|agla tab|अगला टैब)$/.test(text)) return {type:'move', direction:1};
  if (/^(?:previous tab|pichhla tab|पिछला टैब)$/.test(text)) return {type:'move', direction:-1};
  if (/^(?:reload|refresh|tab reload karo|page refresh karo)$/.test(text)) return {type:'reload'};
  if (/^(?:close tab|tab band karo|tab close karo)$/.test(text)) return {type:'confirm-close'};
  return null;
}
function submitCommand(raw) {
  if (!raw.trim()) return;
  input.value = raw; const action = parseCommand(raw);
  if (!action) { addLog('Command not recognized', 'Try “open YouTube”, “search cats”, or “next tab”.', '？'); return; }
  if (action.type === 'confirm-close') {
    pendingClose = true; $('approval-text').textContent = 'This will close your current tab. Confirm to continue.'; $('approval').classList.remove('hidden'); return;
  }
  chrome.runtime.sendMessage({type:'COMMAND', action}, (response) => {
    if (chrome.runtime.lastError || !response?.ok) { addLog('Could not complete action', response?.error || 'Please try again.', '!'); return; }
    addLog(response.title, response.detail, response.icon || '↗');
  });
}
$('send').addEventListener('click', () => submitCommand(input.value));
input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submitCommand(input.value); });
mic.addEventListener('click', () => {
  if (!Recognition) { micLabel.textContent = 'VOICE NOT SUPPORTED IN THIS CHROME'; return; }
  const recognition = new Recognition(); recognition.lang = $('language').value; recognition.interimResults = false; recognition.maxAlternatives = 1;
  recognition.onstart = () => { mic.classList.add('listening'); micLabel.textContent = 'LISTENING…'; };
  recognition.onresult = (event) => { const text = event.results[0][0].transcript; micLabel.textContent = 'HEARD: ' + text.slice(0,32); submitCommand(text); };
  recognition.onerror = () => { micLabel.textContent = 'PLEASE TRY AGAIN'; };
  recognition.onend = () => mic.classList.remove('listening'); recognition.start();
});
$('confirm').addEventListener('click', () => {
  if (!pendingClose) return;
  chrome.runtime.sendMessage({type:'COMMAND', action:{type:'close-confirmed'}}, (response) => {
    if (response?.ok) addLog('Tab closed', 'Closed the active tab after your confirmation.', '×');
  });
  pendingClose = null; $('approval').classList.add('hidden');
});
$('cancel').addEventListener('click', () => { pendingClose = null; $('approval').classList.add('hidden'); addLog('Action cancelled', 'The active tab was left open.', '↩'); });
$('clear').addEventListener('click', () => { $('log').innerHTML = '<div class="empty"><span>✳</span><p>Your recent actions will appear here.</p></div>'; });

