(() => {
  const SITE_NAMES = 'youtube|google|gmail|whatsapp|instagram|linkedin|github|chatgpt';

  function parseCommand(raw) {
    const text = raw.trim().toLocaleLowerCase().replace(/[.!?।]+$/u,'').replace(/\s+/g,' ');
    let match = text.match(new RegExp(`^(?:open|kholo|khol do|launch)\\s+(${SITE_NAMES})$`,'i'));
    if (match) return {type:'open-site',site:match[1].toLowerCase()};
    match = text.match(new RegExp(`^(${SITE_NAMES})\\s+(?:kholo|khol do)$`,'i'));
    if (match) return {type:'open-site',site:match[1].toLowerCase()};
    match = text.match(new RegExp(`^open\\s+(${SITE_NAMES})\\s+in\\s+chrome$`,'i'));
    if (match) return {type:'open-site',site:match[1].toLowerCase()};
    match = text.match(/^(?:open|navigate to)\s+(?:website\s+)?(https:\/\/\S+)$/i);
    if (match) return {type:'open-url',url:match[1]};
    match = text.match(/^(?:open|navigate to)\s+website\s+([a-z0-9.-]+(?:\/[a-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*)?)$/i);
    if (match) return {type:'open-url',url:`https://${match[1]}`};
    match = text.match(/^(?:click|press)\s+(?:the\s+)?(button|tab|menu item|checkbox)\s+(?:named\s+)?(.+)$/i);
    if (match) {
      const role = {button:'ButtonControl',tab:'TabItemControl','menu item':'MenuItemControl',checkbox:'CheckBoxControl'}[match[1].toLowerCase()];
      return {type:'ui-activate',name:match[2].trim(),role,confirmed:false};
    }
    match = text.match(/^(?:switch to|find|show)\s+(?:my\s+)?(.+?)\s+tab$/i)
      || text.match(/^find\s+the\s+tab\s+where\s+(.+?)\s+is\s+open$/i);
    if (match) return {type:'switch-tab-query',query:match[1].trim()};
    if (/^(?:list tabs|show tabs|open tabs dikhao|खुले टैब दिखाओ)$/u.test(text)) return {type:'list-tabs'};
    if (/^(?:what apps are installed|list installed apps|show installed apps|applications dikhao)$/i.test(text)) return {type:'app-list'};
    if (/^(?:open task manager|task manager kholo|task manager खोलो)$/u.test(text)) return {type:'desktop',action:'task-manager'};
    match = text.match(/^(?:open|kholo|khol do|launch)\s+(notepad|calculator|calc|explorer|file explorer)$/i);
    if (match) {
      const app = match[1].toLowerCase().replace(/^file\s+/,'').replace(/^calc$/,'calculator');
      return {type:'desktop',action:`open-${app}`};
    }
    match = text.match(/^(?:open|find|search for)\s+(?:the\s+)?latest\s+([a-z0-9]{2,12})\s+(?:file\s+)?(?:in|from)\s+(downloads|desktop|documents|pictures|videos|music)$/i);
    if (match) return {type:'file-open-latest',scope:match[2].toLowerCase(),extension:`.${match[1].toLowerCase()}`};
    match = text.match(/^(?:open|find)\s+(?:my\s+)?latest\s+([a-z0-9]{2,12})$/i);
    if (match) return {type:'file-open-latest',scope:'all',extension:`.${match[1].toLowerCase()}`};
    match = text.match(/^(downloads|desktop|documents)\s+(?:mein|me)\s+latest\s+([a-z0-9]{2,12})\s+(?:file\s+)?(?:kholo|open karo)$/iu);
    if (match) return {type:'file-open-latest',scope:match[1].toLowerCase(),extension:`.${match[2].toLowerCase()}`};
    match = text.match(/^(?:find|search for)\s+(?:a\s+)?file\s+(.+)$/i)
      || text.match(/^file\s+(?:dhundo|dhoondo)\s+(.+)$/iu);
    if (match) return {type:'file-search',query:match[1].trim(),scope:'all'};
    match = text.match(/^(?:open|launch)\s+(?:my\s+)?(?:file\s+)?(.+\.(?:pdf|txt|rtf|docx?|xlsx?|pptx?|csv|md|jpe?g|png|gif|mp3|wav|mp4|mkv|zip|7z|rar))$/i);
    if (match) return {type:'file-open-name',query:match[1].trim(),scope:'all'};
    match = text.match(/^(?:find|search for)\s+(?:a\s+)?file\s+(.+)$/i)
      || text.match(/^file\s+(?:dhundo|dhoondo)\s+(.+)$/iu);
    if (match) return {type:'file-search',query:match[1].trim(),scope:'all'};
    match = text.match(/^(?:open|find)\s+(?:a\s+)?file\s+(.+)$/i)
      || text.match(/^file\s+kholo\s+(.+)$/iu);
    if (match) return {type:'file-open-name',query:match[1].trim(),scope:'all'};
    match = text.match(/^(?:open|kholo|khol do|launch|खोलो)\s+(?:my\s+)?(downloads|documents|desktop|pictures|videos|music)(?:\s+folder)?$/i)
      || text.match(/^(downloads|documents|desktop|pictures|videos|music)\s+(?:kholo|khol do)$/iu);
    if (match) return {type:'desktop',action:`open-${match[1].toLowerCase()}`};
    if (/^(?:show desktop|desktop dikhao|desktop dikha do|डेस्कटॉप दिखाओ)$/u.test(text)) return {type:'desktop',action:'show-desktop'};
    if (/^(?:switch window|switch app|change window|window badlo|app badlo|window switch karo)$/u.test(text)) return {type:'desktop',action:'switch-window'};
    if (/^(?:volume up|sound badhao|awaaz badhao|आवाज़ बढ़ाओ)$/u.test(text)) return {type:'desktop',action:'volume-up'};
    if (/^(?:volume down|sound kam karo|awaaz kam karo|आवाज़ कम करो)$/u.test(text)) return {type:'desktop',action:'volume-down'};
    if (/^(?:mute|volume mute|awaaz band karo|म्यूट करो)$/u.test(text)) return {type:'desktop',action:'volume-mute'};
    if (/^(?:take screenshot|screenshot lo|screenshot|स्क्रीनशॉट लो)$/u.test(text)) return {type:'desktop',action:'screenshot'};
    if (/^(?:lock computer|lock pc|computer lock karo|pc lock karo|कंप्यूटर लॉक करो)$/u.test(text)) return {type:'confirm-lock'};
    if (/^(?:show windows|list windows|open windows dikhao)$/i.test(text)) return {type:'window-list'};
    if (/^(?:what window is active|what app is open|current app|active window)$/i.test(text)) return {type:'context-read'};
    if (/^(?:inspect window|show controls|inspect this app)$/i.test(text)) return {type:'ui-inspect'};
    match = text.match(/^(minimize|maximize|restore)\s+(?:the\s+)?window\s+(.+)$/i);
    if (match) return {type:'window-state',state:match[1].toLowerCase(),query:match[2].trim()};
    match = text.match(/^(?:focus|switch to)\s+(?:the\s+)?window\s+(.+)$/i);
    if (match) return {type:'window-focus-query',query:match[1].trim()};
    if (/^(?:close tab|tab band karo|tab close karo|टैब बंद करो)$/u.test(text)) return {type:'close-confirm'};
    if (/^(?:next tab|agla tab|अगला टैब)$/u.test(text)) return {type:'move-tab',direction:1};
    if (/^(?:previous tab|pichhla tab|पिछला टैब)$/u.test(text)) return {type:'move-tab',direction:-1};
    if (/^(?:reload|refresh|page refresh karo|पेज रीलोड करो)$/u.test(text)) return {type:'reload'};
    match = text.match(/^(?:search(?:\s+for)?|google|dhundo|dhoondo|search karo|खोजो|ढूंढो)\s+(.+)/iu);
    if (match) return {type:'search',query:match[1].slice(0,240)};
    match = text.match(/^(?:open|reopen|launch|start)\s+(?:the\s+)?app\s+(.+)$/i)
      || text.match(/^(?:switch to|bring)\s+(?:the\s+)?(?:app\s+)?(.+?)(?:\s+to the front)?$/i)
      || text.match(/^app\s+kholo\s+(.+)$/iu);
    if (match) return {type:'app-open',query:match[1].trim()};
    match = text.match(/^(?:open|reopen|launch|start)\s+(.+)$/i);
    if (match) return {type:'app-open',query:match[1].trim()};
    return null;
  }

  function splitPlan(raw) {
    return raw.split(/\s+(?:and then|then|phir|aur phir|uske baad|फिर)\s+/iu).map((part) => part.trim()).filter(Boolean);
  }

  globalThis.SaraPlanner = Object.freeze({parseCommand,splitPlan});
})();
