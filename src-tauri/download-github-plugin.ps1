param(
  [Parameter(Mandatory=$true)]
  [string]$RepoUrl,
  [Parameter(Mandatory=$true)]
  [string]$TargetDir
)

$ErrorActionPreference = 'Stop'

try {
  $cleanUrl = $RepoUrl.Trim().TrimEnd('/')
  $pattern = '^https?://github\.com/([^/]+)/([^/]+)'
  if ($cleanUrl -match $pattern) {
    $owner = $matches[1]
    $repo = $matches[2] -replace '\.git$', ''
  } else {
    exit 0
  }

  $zipUrl = "https://github.com/$owner/$repo/archive/refs/heads/main.zip"
  $tempZip = Join-Path ([System.IO.Path]::GetTempPath()) ("migoto_dl_" + [System.Guid]::NewGuid().ToString('N') + ".zip")
  $tempExtract = Join-Path ([System.IO.Path]::GetTempPath()) ("migoto_ext_" + [System.Guid]::NewGuid().ToString('N'))

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('User-Agent', 'MigotoStudio-Installer')
  $wc.DownloadFile($zipUrl, $tempZip)

  Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

  $manifest = Get-ChildItem -Path $tempExtract -Filter 'plugin.json' -Recurse | Select-Object -First 1
  if ($manifest) {
    if (Test-Path $TargetDir) {
      Remove-Item $TargetDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    Copy-Item -Path (Join-Path $manifest.DirectoryName '*') -Destination $TargetDir -Recurse -Force

    $ver = "1.0.0"
    try {
      $jsonObj = Get-Content $manifest.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($jsonObj.version) { $ver = $jsonObj.version }
    } catch {}

    $meta = @{
      owner = $owner
      repo = $repo
      url = $cleanUrl
      installedVersion = $ver
      lastCheckedVersion = $ver
      updateAvailable = $false
      checkedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    $metaJson = $meta | ConvertTo-Json -Depth 3
    [System.IO.File]::WriteAllText((Join-Path $TargetDir '.github-source.json'), $metaJson, [System.Text.Encoding]::UTF8)
  }

  Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
  Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
  exit 0
} catch {
  # 네트워크 연결 불가 등 실패 시에도 전체 인스톨러가 중단되지 않도록 무시
  exit 0
}
