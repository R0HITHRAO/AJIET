Write-Host "Starting Nourish AI (FastAPI + React.js)..." -ForegroundColor Green

if ([string]::IsNullOrWhiteSpace($env:NOURISH_AUTH_SECRET) -and -not (Test-Path (Join-Path $PSScriptRoot "backend\.env"))) {
    Write-Error "Set NOURISH_AUTH_SECRET or configure it in backend\.env before starting Nourish AI."
    exit 1
}

$repoRoot = $PSScriptRoot
$backendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
} -ArgumentList $repoRoot

Set-Location (Join-Path $repoRoot "frontend")
Write-Host "Backend starting on http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Frontend starting on http://127.0.0.1:5173" -ForegroundColor Cyan
npm run dev
