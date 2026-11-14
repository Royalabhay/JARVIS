$ErrorActionPreference = 'Stop'
$host.UI.RawUI.WindowTitle = 'Sara Windows Companion Setup'

Write-Host ''
Write-Host 'Sara Windows Companion Setup' -ForegroundColor Green
Write-Host 'This creates a private local token. It does not add startup tasks or install services.'
Write-Host ''
$extensionId = Read-Host 'Paste the Sara Chrome Extension ID from Sara Settings'
if ($extensionId -notmatch '^[a-p]{32}$') {
    throw 'That ID does not look like a Chrome extension ID (32 letters from a to p). Copy it from the Sara Settings page.'
}

$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$token = [System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
$rng.Dispose()

$directory = Join-Path $env:LOCALAPPDATA 'SaraVoice'
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$configPath = Join-Path $directory 'agent-config.json'
$config = [ordered]@{ origin = "chrome-extension://$extensionId"; token = $token }
$json = $config | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($configPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host 'Copy the token below into Sara Settings, then keep the Sara companion window open.'
Write-Host ''
Write-Host $token -ForegroundColor Yellow
Write-Host ''
Write-Host 'Settings file: %LOCALAPPDATA%\SaraVoice\agent-config.json'
Write-Host 'To disable access, remove the token from Sara Settings and close the companion.'
Read-Host 'Press Enter to close'
