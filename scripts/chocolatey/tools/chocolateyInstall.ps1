$ErrorActionPreference = 'Stop'

$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"
$exePath = Join-Path $toolsDir 'forge.exe'

$packageArgs = @{
  packageName   = $env:ChocolateyPackageName
  fileFullPath  = $exePath
  url           = 'https://dl.cloudsmith.io/public/ranjantestenv/forge/raw/versions/0.1.0/forge-win-x64.exe'
  checksum      = '28214070c489ab1fccbfefcfb573ab4b58c113f55035c7e10c0a221a2f991e4e'
  checksumType  = 'sha256'
}

Get-ChocolateyWebFile @packageArgs

# Create shim so 'forge' works from anywhere
Install-BinFile -Name 'forge' -Path $exePath
