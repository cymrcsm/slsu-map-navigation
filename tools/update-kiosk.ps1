# Update the kiosk Pi from this laptop: sends the commits on main to the Pi and
# restarts the kiosk. Double-click tools\update-kiosk.cmd, or run:
#   powershell -ExecutionPolicy Bypass -File tools\update-kiosk.ps1
# First connect the laptop's Wi-Fi to SLSU-Kiosk-Map (docs/PI-SETUP.md).
# Only COMMITTED work is sent; the Pi's password is asked once, for the restart.
param(
  [string]$PiHost = '10.42.0.1',
  [string]$PiUser = 'pi'
)
$ErrorActionPreference = 'Continue'   # native tools (git, ssh) report through exit codes
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$target = "$PiUser@$PiHost"
$remoteDir = 'thesis-map-navigation'

function Write-Step($text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }
function Stop-Update($text) {
  Write-Host ''
  Write-Host $text -ForegroundColor Red
  exit 1
}

# ssh options: the laptop's kiosk key if it has one, no password prompts for the
# checks, and a short timeout so a missing Wi-Fi fails fast.
$key = Join-Path $HOME '.ssh\slsu_pi_ed25519'
$sshOpts = @('-o', 'ConnectTimeout=8', '-o', 'StrictHostKeyChecking=accept-new')
if (Test-Path $key) { $sshOpts = @('-i', $key) + $sshOpts }
$env:GIT_SSH_COMMAND = 'ssh ' + (($sshOpts | ForEach-Object { if ($_ -match '\s') { '"' + ($_ -replace '\\', '/') + '"' } else { $_ -replace '\\', '/' } }) -join ' ')

# ---- 1. this laptop
Write-Step 'Checking this laptop'
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') { Stop-Update "You are on branch '$branch'. Switch to main first (git checkout main)." }
$localHead = (git rev-parse HEAD).Trim()
$dirty = git status --porcelain --untracked-files=no | Where-Object { $_ -notmatch '\.gitignore$' }
if ($dirty) {
  Write-Host 'Note: these changes are NOT committed, so they will not be sent:' -ForegroundColor Yellow
  $dirty | ForEach-Object { Write-Host "   $_" }
}
if (-not (git remote | Where-Object { $_ -eq 'kiosk' })) {
  git remote add kiosk "${target}:$remoteDir"
  Write-Host "Added the git remote 'kiosk' ($target)."
}

# ---- 2. reach the Pi
Write-Step "Looking for the kiosk at $PiHost"
if (-not (Test-Connection -ComputerName $PiHost -Count 2 -Quiet)) {
  Stop-Update ("The kiosk does not answer at $PiHost.`n" +
    "Connect this laptop's Wi-Fi to SLSU-Kiosk-Map (USB-tether your phone if you need internet), move closer, and run this again.")
}
$state = & ssh @sshOpts -o BatchMode=yes $target "cd $remoteDir && git rev-parse HEAD && git status --porcelain --untracked-files=no"
if ($LASTEXITCODE -ne 0 -or -not $state) {
  Stop-Update ("The kiosk answers but would not let this laptop in over SSH.`n" +
    "This laptop needs the kiosk key ($key), or run:  ssh $target  once to check the password login.")
}
$state = @($state)
$piHead = $state[0].Trim()
$piChanges = @($state | Select-Object -Skip 1 | Where-Object { $_.Trim() })
Write-Host "Kiosk is on commit $($piHead.Substring(0, 7))."

# ---- 3. keep a copy of the kiosk's admin edits and usage log (never in git)
Write-Step 'Saving a copy of the kiosk''s admin edits and usage log'
$backup = Join-Path $repo ('db\pi-backups\' + (Get-Date -Format 'yyyy-MM-dd_HHmm'))
New-Item -ItemType Directory -Force $backup | Out-Null
foreach ($f in 'kiosk_overrides.db', 'kiosk_logs.db') {
  & scp @sshOpts -q "${target}:$remoteDir/db/$f" (Join-Path $backup $f)
  if ($LASTEXITCODE -eq 0) { Write-Host "   saved db\pi-backups\$(Split-Path -Leaf $backup)\$f" }
  else { Write-Host "   (no $f on the kiosk)" }
}

# ---- 4. is there anything to send, and can it be sent?
if ($piChanges.Count -gt 0) {
  Write-Host ''
  Write-Host 'The kiosk has changes of its own that are not committed:' -ForegroundColor Yellow
  $piChanges | ForEach-Object { Write-Host "   $_" }
  Stop-Update ("The update would be refused, and nothing was changed.`n" +
    "If db/kiosk_overrides.db is listed, someone added or edited places in the admin panel. The copy saved above has them:`n" +
    "compare it with this laptop's db/kiosk_overrides.db, commit what is real, and run this again. Do not just delete it.")
}
if ($piHead -eq $localHead) {
  Write-Host ''
  Write-Host 'The kiosk already has everything on this laptop. Nothing to send.' -ForegroundColor Green
  $again = Read-Host 'Restart the kiosk anyway? (y/N)'
  if ($again -notmatch '^[yY]') { exit 0 }
} else {
  git cat-file -e "$piHead^{commit}" 2>$null
  $known = ($LASTEXITCODE -eq 0)
  if ($known) { git merge-base --is-ancestor $piHead $localHead; $known = ($LASTEXITCODE -eq 0) }
  if (-not $known) {
    Stop-Update ("The kiosk has commits this laptop does not have.`n" +
      "Get the latest first (git pull, with internet), then run this again.")
  }
  Write-Step 'New on this laptop, to be sent to the kiosk'
  git --no-pager log --oneline --no-decorate "$piHead..$localHead"
  $ok = Read-Host 'Send these to the kiosk? (y/N)'
  if ($ok -notmatch '^[yY]') { Stop-Update 'Cancelled. Nothing was changed.' }

  Write-Step 'Sending'
  git push kiosk main
  if ($LASTEXITCODE -ne 0) { Stop-Update 'The push failed (message above). Nothing was restarted.' }
}

# ---- 5. restart the app (needs the Pi's password) and the browser
Write-Step 'Restarting the kiosk app - type the Pi''s password when asked'
& ssh @sshOpts -t $target 'sudo systemctl restart slsu-kiosk'
if ($LASTEXITCODE -ne 0) {
  Write-Host 'The app was not restarted (wrong password?). Files are updated; run this again to restart.' -ForegroundColor Yellow
} else {
  Start-Sleep -Seconds 3
  try {
    $health = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 "http://$PiHost/api/health"
    Write-Host "   kiosk app is running (HTTP $($health.StatusCode))" -ForegroundColor Green
  } catch {
    Write-Host '   the kiosk app did not answer yet - check the kiosk screen' -ForegroundColor Yellow
  }
}

Write-Step 'Restarting the kiosk browser'
& ssh @sshOpts $target "bash $remoteDir/deploy/restart-browser.sh"

Write-Host ''
Write-Host 'Done. Check the kiosk screen.' -ForegroundColor Green
