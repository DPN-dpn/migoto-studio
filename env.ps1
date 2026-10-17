# Migoto Studio - local environment.
# Dot-source this file ( . .\env.ps1 ) to confine every dev tool to this project folder.
# Nothing here touches system PATH, registry or user-level environment variables.

$Root = $PSScriptRoot
$Tool = Join-Path $Root '.toolchain'

$env:CARGO_HOME      = Join-Path $Tool 'cargo'
$env:RUSTUP_HOME     = Join-Path $Tool 'rustup'
$env:npm_config_cache = Join-Path $Tool 'npm-cache'
$env:npm_config_update_notifier = 'false'
$env:TEMP            = Join-Path $Tool 'tmp'
$env:TMP             = $env:TEMP
# WebView2 cache while developing (Tauri dev run) stays in the project too.
$env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $Tool 'webview2-data'

foreach ($d in $env:TEMP, $env:npm_config_cache, $env:WEBVIEW2_USER_DATA_FOLDER) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}

$NodeDir = Join-Path $Tool 'node'
$env:PATH = "$NodeDir;$(Join-Path $env:CARGO_HOME 'bin');$env:PATH"
