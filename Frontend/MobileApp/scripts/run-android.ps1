param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExpoArguments
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sdkPath = $env:ANDROID_HOME
if (-not $sdkPath) { $sdkPath = $env:ANDROID_SDK_ROOT }
if (-not $sdkPath) { $sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path -LiteralPath (Join-Path $sdkPath 'platform-tools\adb.exe'))) {
    throw 'Android SDK not found. Set ANDROID_HOME to the SDK location shown in Android Studio.'
}

$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath
$env:Path = "$(Join-Path $sdkPath 'platform-tools');$(Join-Path $sdkPath 'emulator');$env:Path"
$expoCli = Join-Path $projectRoot 'node_modules\expo\bin\cli'
Push-Location $projectRoot
try {
    & node $expoCli prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & node $expoCli run:android @ExpoArguments
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
