Write-Host "Starting Nourish AI (FastAPI + React.js)..." -ForegroundColor Green

$repoRoot = $PSScriptRoot
$backendEnvFile = Join-Path $repoRoot "backend\.env"
$authSecret = ""
if (-not [string]::IsNullOrWhiteSpace($env:NOURISH_AUTH_SECRET)) {
    $authSecret = $env:NOURISH_AUTH_SECRET.Trim()
}

if ($authSecret.Length -lt 32 -and (Test-Path -LiteralPath $backendEnvFile)) {
    $secretLine = Get-Content -LiteralPath $backendEnvFile |
        Where-Object { $_ -match '^\s*(export\s+)?NOURISH_AUTH_SECRET\s*=' } |
        Select-Object -Last 1
    if ($secretLine -match '^\s*(export\s+)?NOURISH_AUTH_SECRET\s*=\s*(.*)$') {
        $fileSecret = $Matches[2].Trim().Trim('"').Trim("'")
        if ($fileSecret.Length -ge 32) {
            $authSecret = $fileSecret
        }
    }
}

if ($authSecret.Length -lt 32) {
    $authSecret = (python -c "import secrets; print(secrets.token_hex(32))").Trim()
    if ($LASTEXITCODE -ne 0 -or $authSecret.Length -lt 32) {
        Write-Error "Could not generate NOURISH_AUTH_SECRET. Install Python and try again."
        exit 1
    }

    $envLines = @()
    if (Test-Path -LiteralPath $backendEnvFile) {
        $envLines = @(
            Get-Content -LiteralPath $backendEnvFile |
                Where-Object { $_ -notmatch '^\s*(export\s+)?NOURISH_AUTH_SECRET\s*=' }
        )
    }
    $envLines += "NOURISH_AUTH_SECRET=$authSecret"
    $utf8NoBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllLines($backendEnvFile, [string[]]$envLines, $utf8NoBom)
    Write-Host "Generated a local auth secret and saved it in ignored backend\.env." -ForegroundColor Yellow
}

$env:NOURISH_AUTH_SECRET = $authSecret
$backendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
} -ArgumentList $repoRoot

Set-Location (Join-Path $repoRoot "frontend")
Write-Host "Backend starting on http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Frontend starting on http://127.0.0.1:5173" -ForegroundColor Cyan
npm run dev
