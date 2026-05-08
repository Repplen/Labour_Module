[CmdletBinding()]
param(
  [string]$SiteName = "ChecklistApp",
  [int]$Port = 812,
  [string]$HostName = "",
  [int]$BackendPort = 5000,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch]$EnableWindowsFeatures,
  [switch]$OpenFirewall
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[iis-setup] $Message" -ForegroundColor Cyan
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

function Test-AppCmdSection {
  param(
    [string]$AppCmd,
    [string]$Section
  )

  $null = & $AppCmd list config "/section:$Section" 2>$null
  return $LASTEXITCODE -eq 0
}

function Update-WebConfigBackendPort {
  param(
    [string[]]$ConfigPaths,
    [int]$Port
  )

  foreach ($configPath in $ConfigPaths) {
    if (-not (Test-Path -LiteralPath $configPath)) {
      continue
    }

    $content = Get-Content -Raw -LiteralPath $configPath
    $updated = $content -replace "http://127\.0\.0\.1:\d+/", "http://127.0.0.1:$Port/"

    if ($updated -ne $content) {
      Set-Content -LiteralPath $configPath -Value $updated -NoNewline
      Write-Step "Updated backend proxy port in $configPath"
    }
  }
}

Assert-Administrator

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$frontendDistPath = Join-Path $resolvedProjectRoot "frontend\dist"
$frontendPublicWebConfig = Join-Path $resolvedProjectRoot "frontend\public\web.config"
$distWebConfig = Join-Path $frontendDistPath "web.config"

if (-not (Test-Path -LiteralPath $frontendDistPath)) {
  throw "Frontend build folder was not found: $frontendDistPath. Run 'npm run build' from the project root first."
}

if (-not (Test-Path -LiteralPath $distWebConfig)) {
  throw "IIS web.config was not found in frontend/dist. Run 'npm run build' again and confirm frontend/public/web.config exists."
}

if ($EnableWindowsFeatures) {
  Write-Step "Enabling IIS Windows features"
  Enable-WindowsOptionalFeature -Online -All -NoRestart -FeatureName `
    IIS-WebServerRole, `
    IIS-WebServer, `
    IIS-CommonHttpFeatures, `
    IIS-StaticContent, `
    IIS-DefaultDocument, `
    IIS-HttpErrors, `
    IIS-ManagementConsole | Out-Null
}

Write-Step "Loading IIS PowerShell module"
Import-Module WebAdministration

Update-WebConfigBackendPort -ConfigPaths @($frontendPublicWebConfig, $distWebConfig) -Port $BackendPort

$appCmd = Join-Path $env:SystemRoot "System32\inetsrv\appcmd.exe"
if (-not (Test-Path -LiteralPath $appCmd)) {
  Write-Warning "appcmd.exe was not found. Install/enable IIS before running this setup."
} else {
  if (-not (Test-AppCmdSection -AppCmd $appCmd -Section "system.webServer/rewrite")) {
    Write-Warning "URL Rewrite is not installed. Install IIS URL Rewrite, otherwise frontend/dist/web.config will fail with HTTP 500.19."
  }

  if (Test-AppCmdSection -AppCmd $appCmd -Section "system.webServer/proxy") {
    Write-Step "Enabling ARR reverse proxy"
    & $appCmd set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /reverseRewriteHostInResponseHeaders:"False" /commit:apphost | Out-Null
  } else {
    Write-Warning "Application Request Routing (ARR) is not installed. Install ARR and enable proxy for /api and /uploads reverse proxy support."
  }
}

$appPoolName = "$SiteName-AppPool"
if (-not (Test-Path "IIS:\AppPools\$appPoolName")) {
  Write-Step "Creating app pool $appPoolName"
  New-WebAppPool -Name $appPoolName | Out-Null
}

Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name managedRuntimeVersion -Value ""
Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name managedPipelineMode -Value "Integrated"

if (Test-Path "IIS:\Sites\$SiteName") {
  Write-Step "Updating existing site $SiteName"
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $frontendDistPath
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $appPoolName
} else {
  Write-Step "Creating site $SiteName"
  $newWebsiteParams = @{
    Name = $SiteName
    PhysicalPath = $frontendDistPath
    Port = $Port
    ApplicationPool = $appPoolName
  }

  if (-not [string]::IsNullOrWhiteSpace($HostName)) {
    $newWebsiteParams.HostHeader = $HostName
  }

  New-Website @newWebsiteParams | Out-Null
}

$targetBindingInformation = "*:${Port}:$HostName"
$hasBinding = Get-WebBinding -Name $SiteName -Protocol "http" -ErrorAction SilentlyContinue |
  Where-Object { $_.bindingInformation -eq $targetBindingInformation }

if (-not $hasBinding) {
  Write-Step "Adding HTTP binding $targetBindingInformation"
  $newBindingParams = @{
    Name = $SiteName
    Protocol = "http"
    IPAddress = "*"
    Port = $Port
  }

  if (-not [string]::IsNullOrWhiteSpace($HostName)) {
    $newBindingParams.HostHeader = $HostName
  }

  New-WebBinding @newBindingParams | Out-Null
}

if ($OpenFirewall) {
  $ruleName = "$SiteName HTTP $Port"
  $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

  if (-not $existingRule) {
    Write-Step "Opening Windows Firewall port $Port"
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
  }
}

Start-WebSite -Name $SiteName

$displayHost = if ([string]::IsNullOrWhiteSpace($HostName)) { "localhost" } else { $HostName }
Write-Host ""
Write-Host "IIS site is configured." -ForegroundColor Green
Write-Host "Site name:     $SiteName"
Write-Host "Physical path: $frontendDistPath"
Write-Host "Frontend URL:  http://$displayHost`:$Port/"
Write-Host "Backend proxy: http://127.0.0.1:$BackendPort/api"
Write-Host ""
Write-Host "Next: install/start the backend service, then test http://$displayHost`:$Port/api/health"
