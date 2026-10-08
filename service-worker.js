const SITES = {
  youtube:'https://www.youtube.com', google:'https://www.google.com', gmail:'https://mail.google.com',
  whatsapp:'https://web.whatsapp.com', instagram:'https://www.instagram.com', linkedin:'https://www.linkedin.com',
  github:'https://github.com', chatgpt:'https://chatgpt.com'
};
const AGENT = 'http://127.0.0.1:43821';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'SARA_LIST_TABS') { listTabs().then(sendResponse).catch((error) => sendResponse({ok:false,error:error.message})); return true; }
  if (message?.type === 'SARA_HEALTH') { agentRequest('/v1/health', null).then(sendResponse); return true; }
  if (message?.type === 'SARA_ACTION') { execute(message.action).then(sendResponse).catch((error) => sendResponse({ok:false,error:error.message})); return true; }
});

async function listTabs() {
  const tabs = await chrome.tabs.query({currentWindow:true});
  return {ok:true,tabs:tabs.map(({id,title,url,active}) => ({id,title,url,active}))};
}

async function agentRequest(path, action) {
  const permitted = await chrome.permissions.contains({origins:['http://127.0.0.1/*']});
  if (!permitted) return {ok:false,code:'NEEDS_PERMISSION',error:'Open Settings and connect the local Windows companion.'};
  const {token} = await chrome.storage.local.get('token');
  if (!token) return {ok:false,code:'NEEDS_SETUP',error:'Open Settings and add your Windows companion token.'};
  try {
    const response = await fetch(`${AGENT}${path}`, {
      method: action ? 'POST' : 'GET',
      headers: {'Content-Type':'application/json','X-Sara-Token':token},
      body: action ? JSON.stringify(action) : undefined,
      signal: AbortSignal.timeout(4500),
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) return {ok:false,code:result.code,error:result.error || 'The Windows companion rejected this action.'};
    return result;
  } catch {
    return {ok:false,code:'AGENT_OFFLINE',error:'Start the Sara Windows companion, then try again.'};
  }
}

async function execute(action) {
  if (!action || typeof action !== 'object') throw new Error('That action could not be understood.');
  if (action.type === 'open-site') {
    const url = SITES[action.site];
    if (!url) throw new Error('That website is not on Sara’s allowed list.');
    await chrome.tabs.create({url});
    return {ok:true,title:`Opened ${action.site}`,detail:url,spoken:`Opening ${action.site}.`,icon:'↗'};
  }
  if (action.type === 'search') {
    const query = String(action.query || '').trim().slice(0,240);
    if (!query) throw new Error('Say what you want to search for.');
    await chrome.tabs.create({url:`https://www.google.com/search?q=${encodeURIComponent(query)}`});
    return {ok:true,title:'Google search',detail:query,spoken:`Searching for ${query}.`,icon:'⌕'};
  }
  if (action.type === 'move-tab') {
    const tabs = await chrome.tabs.query({currentWindow:true});
    if (!tabs.length) throw new Error('There are no tabs to switch to.');
    const active = tabs.findIndex((tab) => tab.active);
    const targetIndex = (Math.max(0,active) + (action.direction === -1 ? -1 : 1) + tabs.length) % tabs.length;
    await chrome.tabs.update(tabs[targetIndex].id,{active:true});
    return {ok:true,title:action.direction === -1 ? 'Previous tab' : 'Next tab',detail:tabs[targetIndex].title || 'Switched tab',spoken:'Switched tab.',icon:'⇄'};
  }
  if (action.type === 'switch-tab') {
    if (!Number.isInteger(action.tabId)) throw new Error('That tab selection is invalid.');
    const tabs = await chrome.tabs.query({currentWindow:true});
    const target = tabs.find((tab) => tab.id === action.tabId);
    if (!target) throw new Error('That tab is no longer open in this window.');
    await chrome.tabs.update(target.id,{active:true});
    return {ok:true,title:'Switched tab',detail:target.title || 'Active browser tab',spoken:'Switched to that tab.',icon:'⇄'};
  }
  if (action.type === 'reload') {
    const [active] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!active) throw new Error('No active tab was found.');
    await chrome.tabs.reload(active.id);
    return {ok:true,title:'Page reloaded',detail:active.title || 'Active tab',spoken:'Page reloaded.',icon:'⟳'};
  }
  if (action.type === 'close-confirmed') {
    const [active] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!active) throw new Error('No active tab was found.');
    await chrome.tabs.remove(active.id);
    return {ok:true,title:'Tab closed',detail:'Closed after your confirmation.',spoken:'Tab closed.',icon:'×'};
  }
  if (action.type === 'desktop' && typeof action.action === 'string' && /^[a-z-]{3,32}$/.test(action.action)) {
    return agentRequest('/v1/action',{action:action.action});
  }
  throw new Error('That action is not supported.');
}
