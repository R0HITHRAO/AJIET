Write-Host "Starting Nourish AI (FastAPI + React.js)..." -ForegroundColor Green

$backendJob = Start-Job -ScriptBlock {
    Set-Location "c:\Nourish_AI"
    python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
}

Set-Location "c:\Nourish_AI\frontend"
Write-Host "Backend starting on http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Frontend starting on http://127.0.0.1:5173" -ForegroundColor Cyan
npm run dev
