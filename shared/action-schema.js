(() => {
  const sites = new Set(['youtube','google','gmail','whatsapp','instagram','linkedin','github','chatgpt']);
  const desktop = new Set(['open-notepad','open-calculator','open-explorer','open-downloads','open-documents','open-desktop','open-pictures','open-videos','open-music','show-desktop','switch-window','screenshot','task-manager','volume-up','volume-down','volume-mute','lock-computer']);
  const scopes = new Set(['desktop','documents','downloads','pictures','videos','music','all']);
  const roles = new Set(['ButtonControl','TabItemControl','MenuItemControl','CheckBoxControl']);
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);

  function valid(action) {
    if (!action || typeof action !== 'object' || Array.isArray(action) || action.version !== '1' || typeof action.type !== 'string') return false;
    const allowed = {
      'open-site':['site'], 'open-url':['url'], search:['query'], 'move-tab':['direction'], 'switch-tab':['tabId','windowId'], 'switch-tab-query':['query'], 'list-tabs':[], reload:[], 'close-confirm':[], 'close-confirmed':[], 'confirm-lock':[], desktop:['action'], 'app-open':['query'], 'app-list':[], 'file-search':['query','scope','extension','latest'], 'file-open-name':['query','scope'], 'file-open-latest':['scope','extension'], 'file-open':['resultId'], 'file-reveal':['resultId'], 'window-list':[], 'window-focus':['windowId'], 'window-focus-query':['query'], 'window-state':['query','state'], 'window-minimize':['windowId'], 'window-maximize':['windowId'], 'window-restore':['windowId'], 'context-read':[], 'ui-inspect':[], 'ui-activate':['name','role','confirmed']
    };
    const fields = allowed[action.type];
    if (!fields || Object.keys(action).some((key) => !['version','type',...fields].includes(key))) return false;
    switch (action.type) {
      case 'open-site': return sites.has(action.site);
      case 'open-url': { try { const url = new URL(action.url); return url.protocol === 'https:' && text(action.url, 2048); } catch { return false; } }
      case 'search': case 'switch-tab-query': case 'app-open': return text(action.query, action.type === 'search' ? 240 : 160);
      case 'move-tab': return action.direction === 1 || action.direction === -1;
      case 'switch-tab': return Number.isInteger(action.tabId) && action.tabId > 0 && (action.windowId === undefined || Number.isInteger(action.windowId) && action.windowId > 0);
      case 'desktop': return desktop.has(action.action);
      case 'file-search': return (action.query === undefined || text(action.query,160)) && (action.scope === undefined || scopes.has(action.scope)) && (action.extension === undefined || /^\.[a-z0-9]{1,12}$/i.test(action.extension)) && (action.latest === undefined || typeof action.latest === 'boolean');
      case 'file-open-name': return text(action.query,160) && (action.scope === undefined || scopes.has(action.scope));
      case 'file-open-latest': return scopes.has(action.scope) && /^\.[a-z0-9]{1,12}$/i.test(action.extension);
      case 'file-open': case 'file-reveal': return text(action.resultId,64);
      case 'window-focus': case 'window-minimize': case 'window-maximize': case 'window-restore': return Number.isInteger(action.windowId) && action.windowId > 0;
      case 'window-focus-query': return text(action.query,160);
      case 'window-state': return text(action.query,160) && ['minimize','maximize','restore'].includes(action.state);
      case 'ui-activate': return text(action.name,180) && roles.has(action.role) && typeof action.confirmed === 'boolean';
      default: return true;
    }
  }
  globalThis.SaraActionSchema = Object.freeze({valid});
})();
