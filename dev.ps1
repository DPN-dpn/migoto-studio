# Migoto Studio - start development inside the project-local environment.
# Usage: .\dev.ps1            -> tauri dev
#        .\dev.ps1 <command>  -> run any command (e.g. .\dev.ps1 npm install)

. "$PSScriptRoot\env.ps1"
Set-Location $PSScriptRoot

# Make MSVC (linker) discoverable from an ordinary PowerShell.
if (-not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vsPath) {
        $devShell = Join-Path $vsPath 'Common7\Tools\Launch-VsDevShell.ps1'
        & $devShell -Arch amd64 -HostArch amd64 -SkipAutomaticLocation | Out-Null
    } else {
        Write-Warning 'MSVC C++ build tools not found. See docs/UNINSTALL.md / README for requirements.'
    }
}

if ($args.Count -gt 0) {
    $cmd = $args[0]
    $rest = @($args | Select-Object -Skip 1)
    if ($cmd -eq 'test') {
        npm test @rest
    } elseif ($cmd -eq 'build') {
        npm run build @rest
    } else {
        & $cmd @rest
    }
} else {
    npm run tauri dev
}
