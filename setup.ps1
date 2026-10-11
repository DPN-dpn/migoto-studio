# Migoto Studio - one-time dev tool setup.
# Installs portable Node.js (LTS) and Rust (MSVC) into .\.toolchain only.
# To uninstall everything: delete the .toolchain folder (see docs/UNINSTALL.md).
# Requires: Visual Studio / Build Tools with the C++ workload (already on this PC).

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

. "$PSScriptRoot\env.ps1"
New-Item -ItemType Directory -Force -Path $Tool | Out-Null

# ---- Node.js (portable zip) ----
if (-not (Test-Path (Join-Path $NodeDir 'node.exe'))) {
    Write-Host '[setup] Resolving latest Node.js LTS...'
    $idx = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $ver = ($idx | Where-Object { $_.lts } | Select-Object -First 1).version
    $zipUrl = "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip"
    $zip = Join-Path $env:TEMP "node-$ver.zip"
    Write-Host "[setup] Downloading Node $ver ..."
    Invoke-WebRequest $zipUrl -OutFile $zip
    $extract = Join-Path $env:TEMP 'node-extract'
    if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
    Expand-Archive $zip -DestinationPath $extract
    Move-Item (Join-Path $extract "node-$ver-win-x64") $NodeDir
    Remove-Item $zip, $extract -Recurse -Force
} else { Write-Host '[setup] Node already installed.' }

# ---- Rust (rustup, local CARGO_HOME / RUSTUP_HOME, no PATH modification) ----
if (-not (Test-Path (Join-Path $env:CARGO_HOME 'bin\cargo.exe'))) {
    $init = Join-Path $env:TEMP 'rustup-init.exe'
    Write-Host '[setup] Downloading rustup-init ...'
    Invoke-WebRequest 'https://win.rustup.rs/x86_64' -OutFile $init
    Write-Host '[setup] Installing Rust (minimal profile) ...'
    & $init -y --no-modify-path --profile minimal --default-toolchain stable --default-host x86_64-pc-windows-msvc
    if ($LASTEXITCODE -ne 0) { throw 'rustup-init failed' }
    Remove-Item $init -Force
} else { Write-Host '[setup] Rust already installed.' }

Write-Host ''
Write-Host '[setup] Versions:'
& node -v
& npm -v
& rustc -V
& cargo -V
Write-Host '[setup] Done. Use .\dev.ps1 to start development.'
