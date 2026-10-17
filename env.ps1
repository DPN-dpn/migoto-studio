$Toolchain = Join-Path $PSScriptRoot '.toolchain'
$env:PATH = (Join-Path $Toolchain 'node') + ';' + (Join-Path $Toolchain 'cargo\bin') + ';' + $env:PATH
