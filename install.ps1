#Requires -Version 5.1
<#
.SYNOPSIS
    Install CodeAlive to your AI coding agents.
.DESCRIPTION
    Downloads and runs the CodeAlive installer wizard.
    Checks for Node.js and offers to install it if missing.
.EXAMPLE
    irm https://raw.githubusercontent.com/CodeAlive-AI/codealive-installer/main/install.ps1 | iex
.EXAMPLE
    .\install.ps1 -ApiKey "your-key"
.EXAMPLE
    .\install.ps1 -CI -ApiKey "your-key"
#>

param(
    [string]$ApiKey,
    [switch]$CI,
    [switch]$Debug
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n>> $Message" -ForegroundColor Cyan
}

function Write-Err {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

function Test-Command {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-NodeJS {
    Write-Step "Node.js not found. Attempting to install..."

    # Try winget first
    if (Test-Command "winget") {
        Write-Host "Installing Node.js via winget..." -ForegroundColor Yellow
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -eq 0) {
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                        [System.Environment]::GetEnvironmentVariable("Path", "User")
            return $true
        }
    }

    # Try fnm
    if (Test-Command "fnm") {
        Write-Host "Installing Node.js via fnm..." -ForegroundColor Yellow
        fnm install --lts
        fnm use lts-latest
        return $true
    }

    # Try nvm-windows
    if (Test-Command "nvm") {
        Write-Host "Installing Node.js via nvm..." -ForegroundColor Yellow
        nvm install lts
        nvm use lts
        return $true
    }

    # Manual instructions
    Write-Err "Could not install Node.js automatically."
    Write-Host ""
    Write-Host "Install Node.js (v18+) from one of these sources:" -ForegroundColor Yellow
    Write-Host "  1. https://nodejs.org (recommended)"
    Write-Host "  2. winget install OpenJS.NodeJS.LTS"
    Write-Host "  3. choco install nodejs-lts"
    Write-Host ""
    Write-Host "Then re-run this script."
    return $false
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  CodeAlive Installer" -ForegroundColor Cyan
Write-Host "  https://app.codealive.ai" -ForegroundColor DarkGray
Write-Host ""

# Check Node.js
if (-not (Test-Command "node")) {
    $installed = Install-NodeJS
    if (-not $installed) { exit 1 }
}

# Verify Node.js version
$nodeVersion = (node --version) -replace '^v', ''
$major = [int]($nodeVersion.Split('.')[0])
if ($major -lt 18) {
    Write-Err "Node.js v18+ is required (found v$nodeVersion)."
    Write-Host "Update Node.js: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

Write-Step "Running CodeAlive installer (Node.js v$nodeVersion)..."

# Build npx arguments
$npxArgs = @("codealive-installer@latest")

if ($ApiKey) {
    $npxArgs += "--api-key"
    $npxArgs += $ApiKey
}
if ($CI) {
    $npxArgs += "--ci"
}
if ($Debug) {
    $npxArgs += "--debug"
}

# Determine npx command
$npxCmd = if (Test-Command "npx") { "npx" }
          elseif (Test-Command "pnpm") { "pnpm dlx" }
          else { "npx" }

# Run installer
if ($npxCmd -eq "pnpm dlx") {
    & pnpm dlx @npxArgs
} else {
    & npx --yes @npxArgs
}

$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host ""
    Write-Err "Installer exited with code $exitCode."
    Write-Host "Try running manually: npx codealive-installer" -ForegroundColor Yellow
}

exit $exitCode
