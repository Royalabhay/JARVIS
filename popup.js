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
  return row;
}

function normalize(value) {
  return value.trim().toLocaleLowerCase().replace(/[.!?।]+$/u,'').replace(/\s+/g,' ');
}

function showApproval(action) {
  const descriptions = {
    'confirm-lock':['Lock this Windows computer now?', 'Confirm lock'],
    'close-confirm':['Close the active Chrome tab?', 'Confirm close'],
    'ui-activate':[`Activate the ${action.role.replace('Control','').toLowerCase()} named “${action.name}” in the foreground app?`, 'Activate control']
  };
  const [description, button] = descriptions[action.type] || ['Confirm this action?', 'Confirm'];
  $('approval-text').textContent = `${description} Say “confirm” to continue or “cancel” to stop.`;
  $('confirm').textContent = button;
  $('approval').classList.remove('hidden');
  if (listening) say(action.type === 'confirm-lock' ? 'Say confirm to lock the computer, or cancel.' : action.type === 'close-confirm' ? 'Say confirm to close this tab, or cancel.' : `Say confirm to activate ${action.name}, or cancel.`);
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
      let detail = result.detail || 'Action completed.';
      if (Array.isArray(result.results)) detail = result.results.length ? result.results.map((item) => `${item.name} · ${item.path}`).join(' | ') : 'No matching files found in the selected folders.';
      else if (Array.isArray(result.applications)) detail = result.applications.length ? `${result.applications.slice(0,12).map((item) => item.name).join(', ')}${result.applications.length > 12 ? ` · ${result.applications.length - 12} more` : ''}` : 'No Start Menu shortcuts were found.';
      else if (Array.isArray(result.windows)) detail = result.windows.length ? `${result.windows.slice(0,10).map((item) => `${item.title}${item.active ? ' (active)' : ''}`).join(' | ')}${result.windows.length > 10 ? ` · ${result.windows.length - 10} more` : ''}` : 'No open windows were found.';
      else if (Array.isArray(result.controls)) detail = `${result.controls.slice(0,24).map((item) => `${item.role}: ${item.name || '(unnamed)'}`).join(' | ')}${result.controls.length > 24 ? ' · more controls omitted' : ''}`;
      else if (result.foregroundWindow) detail = `Active window: ${result.foregroundWindow.title}`;
      const row = addLog(result.title || (result.results ? 'File search results' : 'Done'),detail,result.icon || '✓');
      if (Array.isArray(result.results) && result.results.length) {
        const choices = document.createElement('div'); choices.className = 'result-actions';
        for (const file of result.results) {
          const item = document.createElement('span'); item.className = 'result-choice';
          const name = document.createElement('b'); name.textContent = file.name;
          const open = document.createElement('button'); open.textContent = 'Open'; open.addEventListener('click',()=>sendAction({version:'1',type:'file-open',resultId:file.id}));
          const reveal = document.createElement('button'); reveal.textContent = 'Show location'; reveal.addEventListener('click',()=>sendAction({version:'1',type:'file-reveal',resultId:file.id}));
          item.append(name,open,reveal); choices.append(item);
        }
        row.append(choices);
      }
      if (listening && announce) say(result.spoken || result.title || 'Done.');
      if (action.type === 'close-confirmed' || action.type === 'switch-tab' || action.type === 'switch-tab-query' || action.type === 'list-tabs') refreshTabs();
      resolve(true);
    });
  });
}

async function continuePlan() {
  const multiStep = pendingPlan.length > 1;
  while (planIndex < pendingPlan.length) {
    const action = pendingPlan[planIndex];
    if (action.type === 'close-confirm' || action.type === 'confirm-lock' || action.type === 'ui-activate' && action.confirmed !== true) { showApproval(action); return; }
    planIndex += 1;
    if (action.type === 'list-tabs') { refreshTabs(); addLog('Open tabs','Updated tabs across normal Chrome windows.','▤'); continue; }
    const ok = await sendAction(action,!multiStep);
    if (!ok) {
      addLog('Workflow stopped','Sara stopped because a step failed. Later steps were not run.','!');
      pendingPlan = []; planIndex = 0;
      return;
    }
  }
  pendingPlan = []; planIndex = 0;
  if (listening && multiStep) say('Done. I completed those commands.');
}

function resolveApproval(approved) {
  const action = pendingPlan[planIndex];
  if (!action || !['confirm-lock','close-confirm','ui-activate'].includes(action.type)) return;
  $('approval').classList.add('hidden');
  if (!approved) {
    pendingPlan = []; planIndex = 0;
    addLog('Cancelled','No sensitive action was taken.','↩');
    if (listening) say('Cancelled.');
    return;
  }
  planIndex += 1;
  const actual = action.type === 'confirm-lock' ? {version:'1',type:'desktop',action:'lock-computer'}
    : action.type === 'close-confirm' ? {version:'1',type:'close-confirmed'}
    : {...action,confirmed:true};
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
  if (pendingPlan.length && ['confirm-lock','close-confirm','ui-activate'].includes(pendingPlan[planIndex]?.type)) {
    addLog('Waiting for approval','Say “confirm” or “cancel” before another command.','!');
    if (fromVoice) say('Please say confirm or cancel first.');
    return;
  }
  const planner = window.SaraPlanner;
  if (!planner) { addLog('Assistant unavailable','Reload Sara to load the command planner.','!'); return; }
  const parts = planner.splitPlan(raw);
  const actions = parts.map(planner.parseCommand).map((action) => action && ({version:'1',...action}));
  if (actions.some((action) => !action)) {
    addLog('I didn’t catch that','Try “Sara, open Gmail”, “next tab”, or “volume up”.','…');
    if (fromVoice) say('Sorry, I did not understand. Try a supported command.');
    return;
  }
  if (actions.some((action) => !window.SaraActionSchema?.valid(action))) {
    addLog('Command needs details','Use a supported action with a clear app, tab, or file name.','!');
    if (fromVoice) say('Please give me a more specific app, tab, or file name.');
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
  if (!tabs.length) { list.innerHTML = '<div class="empty-state"><span class="empty-icon">▤</span><p>No tabs found in normal Chrome windows.</p></div>'; return; }
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
    button.append(icon,copy,arrow); button.addEventListener('click',()=>sendAction({version:'1',type:'switch-tab',tabId:tab.id,windowId:tab.windowId})); list.append(button);
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
