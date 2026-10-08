const $ = (id) => document.getElementById(id);
const id = chrome.runtime.id;
$('extension-id').value = id;
chrome.storage.local.get(['token','language','voiceReply'], (saved) => {
  $('token').value = saved.token || '';
  $('language').value = saved.language || 'en-IN';
  $('voice-reply').checked = saved.voiceReply !== false;
  $('status').textContent = saved.token ? 'Token saved on this computer' : 'Not connected yet';
});
$('copy-id').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(id); $('copy-id').textContent = 'Copied'; }
  catch { $('extension-id').select(); document.execCommand('copy'); $('copy-id').textContent = 'Copied'; }
  setTimeout(() => $('copy-id').textContent = 'Copy ID', 1300);
});
$('show-token').addEventListener('click', () => {
  const input = $('token'); const show = input.type === 'password'; input.type = show ? 'text' : 'password'; $('show-token').textContent = show ? 'Hide' : 'Show';
});
$('save').addEventListener('click', () => {
  const token = $('token').value.trim();
  const saveValues = async (permissionGranted) => {
    chrome.storage.local.set({token,language:$('language').value,voiceReply:$('voice-reply').checked}, () => {
      if (!token) {
        $('status').textContent = 'Desktop token removed.';
        return;
      }
      if (!permissionGranted) {
        $('status').textContent = 'Token saved. Allow Sara’s local connection permission to use Windows actions.';
        return;
      }
      $('status').textContent = 'Checking the Windows companion…';
      fetch('http://127.0.0.1:43821/v1/health', {
        headers:{'X-Sara-Token':token}, cache:'no-store', signal:AbortSignal.timeout(4000)
      }).then(async (response) => {
        const result = await response.json();
        $('status').textContent = response.ok && result.ok
          ? 'Connected. Reopen Sara; desktop actions are ready.'
          : result.error || 'Sara could not connect. Check the companion token.';
      }).catch(() => {
        $('status').textContent = 'Token saved. Start run_agent.bat, allow any Chrome local-network prompt, then save again.';
      });
    });
  };
  if (token) {
    chrome.permissions.request({origins:['http://127.0.0.1/*']}, (granted) => saveValues(granted));
  } else {
    chrome.permissions.remove({origins:['http://127.0.0.1/*']}, () => saveValues(false));
  }
});
