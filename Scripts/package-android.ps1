param(
    [string]$EngineRoot = $env:UE_ROOT,
    [string]$ArchiveDirectory = "Dist/Android",
    [switch]$SkipScriptBuild
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\${Path}"))
}

function Assert-Path([string]$Path, [string]$Message) {
    if (-not (Test-Path $Path)) {
        throw "$Message`: $Path"
    }
}

$ProjectRoot = Resolve-FullPath "."
$ProjectFile = Join-Path $ProjectRoot "PuertsDemo.uproject"
$ArchivePath = Resolve-FullPath $ArchiveDirectory
$V8Root = Join-Path $ProjectRoot "Plugins\Puerts\ThirdParty\v8_9.4.146.24"

if ([string]::IsNullOrWhiteSpace($EngineRoot)) {
    throw "EngineRoot is required. Pass -EngineRoot or set UE_ROOT to your Unreal Engine installation root."
}

$RunUat = Join-Path $EngineRoot "Engine\Build\BatchFiles\RunUAT.bat"
$AndroidSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
$AndroidNdk = $env:ANDROID_NDK_ROOT

Assert-Path $ProjectFile "Project file missing"
Assert-Path $RunUat "RunUAT.bat missing"
Assert-Path $V8Root "Puerts V8 third-party directory missing"

if ([string]::IsNullOrWhiteSpace($AndroidSdk) -or -not (Test-Path $AndroidSdk)) {
    throw "Android SDK missing. Set ANDROID_HOME or ANDROID_SDK_ROOT."
}

if ([string]::IsNullOrWhiteSpace($AndroidNdk) -or -not (Test-Path $AndroidNdk)) {
    throw "Android NDK missing. Set ANDROID_NDK_ROOT."
}

if (-not $SkipScriptBuild) {
    Push-Location $ProjectRoot
    try {
        npm run build:shipping
    } finally {
        Pop-Location
    }
}

New-Item -ItemType Directory -Force -Path $ArchivePath | Out-Null

$Arguments = @(
    "BuildCookRun",
    "-project=$ProjectFile",
    "-platform=Android",
    "-clientconfig=Shipping",
    "-serverconfig=Shipping",
    "-cook",
    "-stage",
    "-pak",
    "-archive",
    "-archivedirectory=$ArchivePath",
    "-utf8output"
)

Write-Host "[package-android] Running UAT Android Shipping package..."
& $RunUat @Arguments

if ($LASTEXITCODE -ne 0) {
    throw "RunUAT failed with exit code $LASTEXITCODE"
}

Write-Host "[package-android] Android package archived to $ArchivePath"
