[CmdletBinding()]
param(
  [string]$ServiceName = "ChecklistBackend",
  [int]$Port = 5000,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$NodePath = "",
  [string]$NssmPath = ""
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[backend-service] $Message" -ForegroundColor Cyan
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-Administrator {
  if (-not (Test-IsAdministrator)) {
    throw "Run this script from an elevated PowerShell window: right-click PowerShell and choose 'Run as administrator'."
  }
}

function Resolve-CommandPath {
  param(
    [string]$CommandName,
    [string]$ProvidedPath,
    [string]$InstallHint
  )

  if (-not [string]::IsNullOrWhiteSpace($ProvidedPath)) {
    if (-not (Test-Path -LiteralPath $ProvidedPath)) {
      throw "$CommandName was not found at '$ProvidedPath'. $InstallHint"
    }

    return (Resolve-Path -LiteralPath $ProvidedPath).Path
  }

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "$CommandName was not found on PATH. $InstallHint"
  }

  return $command.Source
}

Assert-Administrator

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$backendPath = Join-Path $resolvedProjectRoot "backend"
$serverPath = Join-Path $backendPath "server.js"
$envPath = Join-Path $backendPath ".env"
$envExamplePath = Join-Path $backendPath ".env.example"
$logsPath = Join-Path $backendPath "logs"

if (-not (Test-Path -LiteralPath $serverPath)) {
  throw "Backend entrypoint was not found: $serverPath"
}

if (-not (Test-Path -LiteralPath $envPath)) {
  if (Test-Path -LiteralPath $envExamplePath) {
    Copy-Item -LiteralPath $envExamplePath -Destination $envPath
    Write-Warning "Created backend\.env from backend\.env.example. Update MONGODB_URI, JWT_SECRET, and CORS_ORIGIN before production use."
  } else {
    throw "backend\.env was not found and backend\.env.example is missing."
  }
}

New-Item -ItemType Directory -Force -Path $logsPath | Out-Null

$resolvedNodePath = Resolve-CommandPath `
  -CommandName "node" `
  -ProvidedPath $NodePath `
  -InstallHint "Install Node.js LTS, then run this script again."

$resolvedNssmPath = Resolve-CommandPath `
  -CommandName "nssm" `
  -ProvidedPath $NssmPath `
  -InstallHint "Install NSSM and either add nssm.exe to PATH or pass -NssmPath 'C:\path\to\nssm.exe'."

$serviceExists = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if (-not $serviceExists) {
  Write-Step "Installing Windows service $ServiceName"
  & $resolvedNssmPath install $ServiceName $resolvedNodePath "server.js" | Out-Null
} else {
  Write-Step "Updating existing Windows service $ServiceName"
}

& $resolvedNssmPath set $ServiceName AppDirectory $backendPath | Out-Null
& $resolvedNssmPath set $ServiceName Application $resolvedNodePath | Out-Null
& $resolvedNssmPath set $ServiceName AppParameters "server.js" | Out-Null
& $resolvedNssmPath set $ServiceName AppEnvironmentExtra "NODE_ENV=production" "PORT=$Port" | Out-Null
& $resolvedNssmPath set $ServiceName AppStdout (Join-Path $logsPath "service.out.log") | Out-Null
& $resolvedNssmPath set $ServiceName AppStderr (Join-Path $logsPath "service.err.log") | Out-Null
& $resolvedNssmPath set $ServiceName AppRotateFiles 1 | Out-Null
& $resolvedNssmPath set $ServiceName AppRotateOnline 1 | Out-Null
& $resolvedNssmPath set $ServiceName AppRotateBytes 10485760 | Out-Null
& $resolvedNssmPath set $ServiceName Start SERVICE_AUTO_START | Out-Null

Write-Step "Starting service $ServiceName"
if ($serviceExists -and $serviceExists.Status -eq "Running") {
  & $resolvedNssmPath restart $ServiceName | Out-Null
} else {
  & $resolvedNssmPath start $ServiceName | Out-Null
}

Write-Host ""
Write-Host "Backend service is configured." -ForegroundColor Green
Write-Host "Service name: $ServiceName"
Write-Host "Backend path: $backendPath"
Write-Host "Health URL:   http://127.0.0.1:$Port/api/health"
Write-Host "Logs:         $logsPath"
Write-Host ""
Write-Host "Important: confirm backend\.env has NODE_ENV=production, MONGODB_URI, JWT_SECRET, and CORS_ORIGIN for your IIS URL."
