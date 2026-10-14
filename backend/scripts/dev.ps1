param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('api', 'worker', 'generate', 'migrate', 'migration-status', 'build', 'test')]
    [string]$Task
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Find-GoTool([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $toolBin = (& go env GOBIN).Trim()
    if (-not $toolBin) { $toolBin = Join-Path (& go env GOPATH).Trim() 'bin' }
    $candidate = Join-Path $toolBin "$Name.exe"
    if (Test-Path -LiteralPath $candidate) { return $candidate }
    throw "$Name is not installed. Install the version in docs/development.md."
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    switch ($Task) {
        'api' { & go run ./cmd/api }
        'worker' { & go run ./cmd/worker }
        'generate' { & (Find-GoTool 'sqlc') generate }
        'migrate' {
            & go run ./cmd/migrate -action up
        }
        'migration-status' {
            & go run ./cmd/migrate -action status
        }
        'build' { & go build ./... }
        'test' { & go test ./... }
    }
    if ($LASTEXITCODE -ne 0) { throw "$Task failed with exit code $LASTEXITCODE." }
} finally { Pop-Location }
