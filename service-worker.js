const SITES = {
  youtube: 'https://www.youtube.com', google: 'https://www.google.com', gmail: 'https://mail.google.com',
  whatsapp: 'https://web.whatsapp.com', instagram: 'https://www.instagram.com', linkedin: 'https://www.linkedin.com',
  github: 'https://github.com', chatgpt: 'https://chatgpt.com'
};
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'COMMAND') return;
  execute(message.action).then(sendResponse).catch((error) => sendResponse({ok:false, error:error.message || 'Action failed.'}));
  return true;
});
async function execute(action) {
  const [active] = await chrome.tabs.query({active:true, currentWindow:true});
  if (!action || !active) throw new Error('Could not find the active browser tab.');
  switch(action.type) {
    case 'open': {
      const target = SITES[action.site]; if (!target) throw new Error('That website is not on the allowed list.');
      await chrome.tabs.create({url:target}); return {ok:true,title:`Opened ${action.site}`,detail:target,icon:'↗'};
    }
    case 'search': {
      const query = String(action.query || '').slice(0,240);
      await chrome.tabs.create({url:`https://www.google.com/search?q=${encodeURIComponent(query)}`});
      return {ok:true,title:'Google search',detail:query,icon:'⌕'};
    }
    case 'move': {
      const tabs = await chrome.tabs.query({currentWindow:true});
      const targetIndex = (active.index + action.direction + tabs.length) % tabs.length;
      await chrome.tabs.update(tabs[targetIndex].id,{active:true});
      return {ok:true,title:action.direction > 0 ? 'Next tab' : 'Previous tab',detail:`Switched to tab ${targetIndex + 1} of ${tabs.length}.`,icon:'⇄'};
    }
    case 'reload':
      await chrome.tabs.reload(active.id); return {ok:true,title:'Page reloaded',detail:active.title || active.url,icon:'⟳'};
    case 'close-confirmed':
      await chrome.tabs.remove(active.id); return {ok:true,title:'Tab closed',detail:'Closed the active tab after your confirmation.',icon:'×'};
    default: throw new Error('Unsupported action.');
  }
}
