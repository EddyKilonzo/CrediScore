# Quick start script for fraud detection service

Write-Host "Starting Fraud Detection Service..." -ForegroundColor Cyan

if (!(Test-Path "venv")) {
    Write-Host "❌ Virtual environment not found!" -ForegroundColor Red
    Write-Host "Run setup_service.ps1 first" -ForegroundColor Yellow
    exit 1
}

.\venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
