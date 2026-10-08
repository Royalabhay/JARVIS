const $ = (id) => document.getElementById(id);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let settings = { token:'', language:'en-IN', voiceReply:true };
let listening = false;
let activeRecognition = null;
let restartTimer = null;
let pendingPlan = [];
let planIndex = 0;

function updateMic(label, detail) {
  $('mic-label').textContent = label;
  $('heard').textContent = detail;
}

function say(text) {
  if (!settings.voiceReply || !window.speechSynthesis) {
    if (listening) scheduleRecognition(250);
    return;
  }
  if (activeRecognition) { activeRecognition.abort(); activeRecognition = null; }
  clearTimeout(restartTimer);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = settings.language;
  utterance.onend = () => { if (listening) scheduleRecognition(450); };
  utterance.onerror = () => { if (listening) scheduleRecognition(450); };
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
  const time = document.createElement('time'); time.textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  row.append(glyph, copy, time); log.prepend(row);
  while (log.children.length > 15) log.lastElementChild.remove();
}

function normalize(value) {
  return value.trim().toLocaleLowerCase().replace(/[.!?।]+$/u,'').replace(/\s+/g,' ');
}

const SITE_NAMES = 'youtube|google|gmail|whatsapp|instagram|linkedin|github|chatgpt';
function parseCommand(raw) {
  const text = normalize(raw);
  let match = text.match(new RegExp(`^(?:open|kholo|khol do|launch)\\s+(${SITE_NAMES})$`,'i'));
  if (match) return {type:'open-site',site:match[1].toLowerCase()};
  match = text.match(new RegExp(`^(${SITE_NAMES})\\s+(?:kholo|khol do)$`,'i'));
  if (match) return {type:'open-site',site:match[1].toLowerCase()};
  match = text.match(/^(?:open|kholo|khol do|launch)\s+(notepad|calculator|calc|explorer|file explorer)$/i);
  if (match) {
    const app = match[1].toLowerCase().replace(/^file\s+/,'').replace(/^calc$/,'calculator');
    return {type:'desktop',action:`open-${app}`};
  }
  match = text.match(/^(?:search(?:\s+for)?|google|dhundo|dhoondo|search karo|खोजो|ढूंढो)\s+(.+)/iu);
  if (match) return {type:'search',query:match[1].slice(0,240)};
  if (/^(?:next tab|agla tab|अगला टैब|अगला टॅब)$/.test(text)) return {type:'move-tab',direction:1};
  if (/^(?:previous tab|pichhla tab|पिछला टैब)$/.test(text)) return {type:'move-tab',direction:-1};
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
  if (/^(?:list tabs|show tabs|open tabs dikhao|खुले टैब दिखाओ)$/.test(text)) return {type:'list-tabs'};
  return null;
}

function splitPlan(raw) {
  return raw.split(/\s+(?:and then|then|phir|aur phir|uske baad|फिर)\s+/iu).map((part) => part.trim()).filter(Boolean);
}

function showApproval(action) {
  $('approval-text').textContent = action.type === 'confirm-lock'
    ? 'Lock this Windows computer now? Say “confirm” to continue or “cancel” to stop.'
    : 'Close your current Chrome tab? Say “confirm” to continue or “cancel” to stop.';
  $('confirm').textContent = action.type === 'confirm-lock' ? 'Confirm lock' : 'Confirm close';
  $('approval').classList.remove('hidden');
  if (listening) say(action.type === 'confirm-lock' ? 'Say confirm to lock the computer, or cancel.' : 'Say confirm to close this tab, or cancel.');
}

async function sendAction(action, announce = true) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({type:'SARA_ACTION',action}, (result) => {
      if (chrome.runtime.lastError) {
        addLog('Sara connection error','Reopen the assistant and try again.','!'); resolve(false); return;
      }
      if (!result?.ok) {
        addLog('Action needs setup',result?.error || 'Open Settings to connect Sara to this computer.','!');
        if (result?.code === 'AGENT_OFFLINE' || result?.code === 'NEEDS_SETUP' || result?.code === 'NEEDS_PERMISSION') setConnection(false,result.error);
        if (listening && announce) say(result?.error || 'Please check Sara settings.');
        resolve(false); return;
      }
      addLog(result.title || 'Done',result.detail || 'Action completed.',result.icon || '✓');
      if (listening && announce) say(result.spoken || result.title || 'Done.');
      if (action.type === 'confirm-close' || action.type === 'switch-tab' || action.type === 'list-tabs') refreshTabs();
      resolve(true);
    });
  });
}

async function continuePlan() {
  const multiStep = pendingPlan.length > 1;
  while (planIndex < pendingPlan.length) {
    const action = pendingPlan[planIndex];
    if (action.type === 'confirm-close' || action.type === 'confirm-lock') { showApproval(action); return; }
    planIndex += 1;
    if (action.type === 'list-tabs') { refreshTabs(); addLog('Open tabs','Updated the list of tabs in this window.','▤'); continue; }
    await sendAction(action,!multiStep);
  }
  pendingPlan = []; planIndex = 0;
  if (listening && multiStep) say('Done. I completed those commands.');
}

function resolveApproval(approved) {
  const action = pendingPlan[planIndex];
  if (!action || (action.type !== 'confirm-lock' && action.type !== 'confirm-close')) return;
  $('approval').classList.add('hidden');
  if (!approved) {
    pendingPlan = []; planIndex = 0;
    addLog('Cancelled','No sensitive action was taken.','↩');
    if (listening) say('Cancelled.');
    return;
  }
  planIndex += 1;
  const actual = action.type === 'confirm-lock' ? {type:'desktop',action:'lock-computer'} : {type:'close-confirmed'};
  sendAction(actual,pendingPlan.length===1).then((ok) => { if (ok) continuePlan(); else { pendingPlan=[]; planIndex=0; } });
}

function cleanWakePrefix(raw) {
  return raw.trim().replace(/^(?:sara|सारा|सारा जी)[\s,:-]*/iu,'').trim();
}

function handleVoiceTranscript(raw) {
  $('heard').textContent = `Heard: ${raw}`;
  const command = cleanWakePrefix(raw);
  const text = normalize(command);
  if (/^(?:stop listening|go to sleep|sara stop|बस|सुनना बंद करो|रुक जाओ)$/.test(text)) {
    if (pendingPlan.length) resolveApproval(false);
    stopListening('Tap the mic to start again','Listening stopped by voice command.');
    return;
  }
  if (pendingPlan.length && /^(?:yes|yes please|confirm|haan|han|हाँ|हां|जी|करो|पक्का)$/.test(text)) { resolveApproval(true); return; }
  if (pendingPlan.length && /^(?:no|cancel|nahi|nahin|नहीं|नही|मत करो)$/.test(text)) { resolveApproval(false); return; }
  runCommand(command,true);
}

function runCommand(raw, fromVoice = false) {
  if (!raw.trim()) return;
  $('command').value = raw;
  if (pendingPlan.length && (pendingPlan[planIndex]?.type === 'confirm-lock' || pendingPlan[planIndex]?.type === 'confirm-close')) {
    addLog('Waiting for approval','Say “confirm” or “cancel” before another command.','!');
    if (fromVoice) say('Please say confirm or cancel first.');
    return;
  }
  const parts = splitPlan(raw);
  const actions = parts.map(parseCommand);
  if (actions.some((action) => !action)) {
    addLog('I didn’t catch that','Try “Sara, open Gmail”, “next tab”, or “volume up”.','…');
    if (fromVoice) say('Sorry, I did not understand. Try a supported command.');
    return;
  }
  pendingPlan = actions; planIndex = 0;
  continuePlan();
}

function setConnection(online,label) {
  const element = $('connection');
  element.classList.toggle('online',online); element.classList.toggle('offline',!online);
  element.querySelector('span').textContent = online ? 'DESKTOP READY' : (label ? 'SETUP NEEDED' : 'DESKTOP OFF');
  element.title = label || (online ? 'Sara desktop companion connected' : 'Start the Windows companion to enable desktop actions');
}

function renderTabs(tabs) {
  const list = $('tabs-list'); $('tab-count').textContent = String(tabs.length);
  if (!tabs.length) { list.innerHTML = '<div class="empty-state"><span class="empty-icon">▤</span><p>No browser tabs found in this window.</p></div>'; return; }
  list.replaceChildren();
  for (const tab of tabs.slice(0,20)) {
    const button = document.createElement('button'); button.className='tab-row'; button.dataset.tabId=String(tab.id);
    const icon=document.createElement('span'); icon.className='tab-favicon'; icon.textContent=tab.active?'●':'◉';
    const copy=document.createElement('span'); copy.className='tab-copy';
    const title=document.createElement('b'); title.textContent=tab.title||'Untitled tab';
    const domain=document.createElement('small');
    try { domain.textContent=new URL(tab.url||'').hostname||'Chrome page'; } catch { domain.textContent='Chrome page'; }
    copy.append(title,domain);
    const arrow=document.createElement('span'); arrow.className='tab-open'; arrow.textContent=tab.active?'✓':'↗';
    button.append(icon,copy,arrow); button.addEventListener('click',()=>sendAction({type:'switch-tab',tabId:tab.id})); list.append(button);
  }
}

function refreshTabs() {
  chrome.runtime.sendMessage({type:'SARA_LIST_TABS'},(result)=>{ if(!chrome.runtime.lastError&&result?.ok) renderTabs(result.tabs); });
}

function scheduleRecognition(delay = 450) {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(startRecognition,delay);
}

function startRecognition() {
  if (!listening || !Recognition || activeRecognition || window.speechSynthesis?.speaking) return;
  const recognition = new Recognition(); activeRecognition=recognition;
  recognition.lang=settings.language; recognition.interimResults=false; recognition.maxAlternatives=1; recognition.continuous=true;
  recognition.onstart=()=>{ $('mic').classList.add('listening'); updateMic('Listening for Sara','Say a command; say “stop listening” to pause.'); };
  recognition.onresult=(event)=>{
    for (let index=event.resultIndex;index<event.results.length;index++) {
      if (event.results[index].isFinal) handleVoiceTranscript(event.results[index][0].transcript);
    }
  };
  recognition.onerror=(event)=>{
    if (event.error==='not-allowed'||event.error==='service-not-allowed') stopListening('Microphone blocked','Allow microphone access in Chrome site settings.');
    else if (event.error!=='no-speech'&&event.error!=='aborted') updateMic('Voice paused','Tap the mic to try again.');
  };
  recognition.onend=()=>{
    if (activeRecognition===recognition) activeRecognition=null;
    $('mic').classList.remove('listening');
    if (listening&&!window.speechSynthesis?.speaking) scheduleRecognition(500);
  };
  try { recognition.start(); }
  catch { activeRecognition=null; if(listening) scheduleRecognition(900); }
}

function startListening() {
  if (!Recognition) { updateMic('Voice unavailable','Use the command box below instead.'); return; }
  listening=true; $('mic').classList.add('listening'); $('mic').setAttribute('aria-label','Stop listening');
  updateMic('Starting…','Say a command; say “stop listening” to pause.');
  startRecognition();
}

function stopListening(label='Tap to speak',detail='Listening stopped.') {
  listening=false; clearTimeout(restartTimer);
  if(activeRecognition){ const current=activeRecognition; activeRecognition=null; current.abort(); }
  window.speechSynthesis?.cancel();
  $('mic').classList.remove('listening'); $('mic').setAttribute('aria-label','Start listening');
  updateMic(label,detail);
}

if (Recognition) $('mic').addEventListener('click',()=>listening?stopListening():startListening());
else { $('mic').disabled=true; updateMic('Voice unavailable','Use the command box below instead.'); }
$('send').addEventListener('click',()=>runCommand($('command').value));
$('command').addEventListener('keydown',(event)=>{if(event.key==='Enter')runCommand($('command').value);});
document.querySelectorAll('[data-command]').forEach((button)=>button.addEventListener('click',()=>runCommand(button.dataset.command)));
$('settings-open').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('refresh-tabs').addEventListener('click',refreshTabs);
$('clear').addEventListener('click',()=>$('log').innerHTML='<div class="empty-state compact"><p>Your actions will appear here.</p></div>');
$('confirm').addEventListener('click',()=>resolveApproval(true));
$('cancel').addEventListener('click',()=>resolveApproval(false));

chrome.storage.local.get(['token','language','voiceReply'],(saved)=>{
  settings={...settings,...saved}; $('language').value=settings.language;
  setConnection(false,settings.token?'':'Add the Windows companion token in Settings.');
  chrome.runtime.sendMessage({type:'SARA_HEALTH'},(result)=>setConnection(!!result?.ok,result?.error)); refreshTabs();
});
$('language').addEventListener('change',()=>{settings.language=$('language').value;chrome.storage.local.set({language:settings.language});});
