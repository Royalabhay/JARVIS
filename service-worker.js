const SITES = {
  youtube:'https://www.youtube.com', google:'https://www.google.com', gmail:'https://mail.google.com',
  whatsapp:'https://web.whatsapp.com', instagram:'https://www.instagram.com', linkedin:'https://www.linkedin.com',
  github:'https://github.com', chatgpt:'https://chatgpt.com'
};
const AGENT = 'http://127.0.0.1:43821';

importScripts('shared/action-schema.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'SARA_LIST_TABS') { listTabs().then(sendResponse).catch(() => sendResponse({ok:false,error:'Chrome could not list tabs.'})); return true; }
  if (message?.type === 'SARA_HEALTH') { agentRequest('/v1/health').then(sendResponse); return true; }
  if (message?.type === 'SARA_ACTION') { execute(message.action).then(sendResponse).catch((error) => sendResponse({ok:false,error:error.message})); return true; }
});

async function listTabs() {
  const tabs = await chrome.tabs.query({});
  return {ok:true,tabs:tabs.filter((tab) => !tab.incognito).map(({id,title,url,active,windowId}) => ({id,title,url,active,windowId}))};
}

async function agentRequest(path, action) {
  const permitted = await chrome.permissions.contains({origins:['http://127.0.0.1/*']});
  if (!permitted) return {ok:false,code:'NEEDS_PERMISSION',error:'Open Settings and connect the local Windows companion.'};
  const {token} = await chrome.storage.local.get('token');
  if (!token) return {ok:false,code:'NEEDS_SETUP',error:'Open Sara Settings and add the Windows companion token.'};
  try {
    const response = await fetch(`${AGENT}${path}`, {
      method: action ? 'POST' : 'GET',
      headers: {'Content-Type':'application/json','X-Sara-Token':token},
      body: action ? JSON.stringify({action}) : undefined,
      signal: AbortSignal.timeout(12000), cache:'no-store'
    });
    const result = await response.json();
    if (!response.ok) return {ok:false,code:result.code,error:result.error || 'The Windows companion rejected this action.'};
    return result;
  } catch {
    return {ok:false,code:'AGENT_OFFLINE',error:'Start the Sara Windows companion, then try again.'};
  }
}

async function execute(action) {
  if (!window.SaraActionSchema?.valid(action)) return {ok:false,code:'ACTION_DENIED',error:'That action is not in Sara’s approved command list.'};
  if (action.type === 'open-site') {
    const url = SITES[action.site];
    if (!url) return {ok:false,error:'That website is not on Sara’s allowed list.'};
    await chrome.tabs.create({url});
    return {ok:true,title:`Opened ${action.site}`,detail:url,spoken:`Opening ${action.site}.`,icon:'↗'};
  }
  if (action.type === 'open-url') {
    await chrome.tabs.create({url:action.url});
    return {ok:true,title:'Website opened',detail:action.url,spoken:'Opening website.',icon:'↗'};
  }
  if (action.type === 'search') {
    const query = action.query.trim().slice(0,240);
    await chrome.tabs.create({url:`https://www.google.com/search?q=${encodeURIComponent(query)}`});
    return {ok:true,title:'Google search',detail:query,spoken:`Searching for ${query}.`,icon:'⌕'};
  }
  if (action.type === 'list-tabs') return listTabs();
  if (action.type === 'move-tab') {
    const tabs = await chrome.tabs.query({currentWindow:true});
    if (!tabs.length) return {ok:false,error:'There are no tabs to switch to.'};
    const active = tabs.findIndex((tab) => tab.active);
    const index = (Math.max(0,active) + action.direction + tabs.length) % tabs.length;
    await chrome.tabs.update(tabs[index].id,{active:true});
    return {ok:true,title:action.direction === -1 ? 'Previous tab' : 'Next tab',detail:tabs[index].title || 'Switched tab',spoken:'Switched tab.',icon:'⇄'};
  }
  if (action.type === 'switch-tab') {
    const target = await chrome.tabs.get(action.tabId).catch(() => null);
    if (!target) return {ok:false,error:'That tab is no longer open.'};
    await chrome.tabs.update(target.id,{active:true});
    if (target.windowId !== chrome.windows.WINDOW_ID_CURRENT) await chrome.windows.update(target.windowId,{focused:true});
    return {ok:true,title:'Switched tab',detail:target.title || 'Active browser tab',spoken:'Switched to that tab.',icon:'⇄'};
  }
  if (action.type === 'switch-tab-query') {
    const query = action.query.toLocaleLowerCase();
    const tabs = await chrome.tabs.query({}).then((rows) => rows.filter((tab) => !tab.incognito));
    const matches = tabs.filter((tab) => `${tab.title || ''} ${tab.url || ''}`.toLocaleLowerCase().includes(query));
    if (matches.length !== 1) return {ok:false,code:matches.length?'TAB_AMBIGUOUS':'TAB_NOT_FOUND',error:matches.length?`Several tabs match “${action.query}”. Add more words.`:`I couldn't find a tab matching “${action.query}”.`};
    const target = matches[0];
    await chrome.tabs.update(target.id,{active:true});
    if (target.windowId !== chrome.windows.WINDOW_ID_CURRENT) await chrome.windows.update(target.windowId,{focused:true});
    return {ok:true,title:'Switched tab',detail:target.title || target.url,spoken:'Switched to the matching tab.',icon:'⇄'};
  }
  if (action.type === 'reload') {
    const [active] = await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if (!active) return {ok:false,error:'No active tab was found.'};
    await chrome.tabs.reload(active.id);
    return {ok:true,title:'Page reloaded',detail:active.title || 'Active tab',spoken:'Page reloaded.',icon:'⟳'};
  }
  if (action.type === 'close-confirm') return {ok:true,title:'Confirmation required',detail:'Sara will close the active tab only after you confirm.'};
  if (action.type === 'close-confirmed') {
    const [active] = await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if (!active) return {ok:false,error:'No active tab was found.'};
    await chrome.tabs.remove(active.id);
    return {ok:true,title:'Tab closed',detail:'Closed after your confirmation.',spoken:'Tab closed.',icon:'×'};
  }
  if (action.type === 'confirm-lock') return {ok:true,title:'Confirmation required',detail:'Sara will lock Windows only after you confirm.'};
  if (action.type === 'desktop' && action.action === 'lock-computer') return agentRequest('/v1/action',{version:'1',type:'desktop',action:'lock-computer'});
  if (action.type === 'desktop' || action.type.startsWith('app-') || action.type.startsWith('file-') || action.type.startsWith('window-') || ['context-read','ui-inspect','ui-activate'].includes(action.type)) {
    return agentRequest('/v1/action',action);
  }
  return {ok:false,code:'ACTION_DENIED',error:'That action is not supported.'};
}
