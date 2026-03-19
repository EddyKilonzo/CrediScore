# Fraud Detection Service Setup Script
# This script sets up the fraud detection service with compatible Python version

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fraud Detection Service Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
$pythonVersion = python --version 2>&1
Write-Host "Current Python version: $pythonVersion" -ForegroundColor Yellow

if ($pythonVersion -match "3\.14") {
    Write-Host ""
    Write-Host "⚠️  Python 3.14 detected - this version has compatibility issues" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Yellow
    Write-Host "  1. Install Python 3.12 from python.org/downloads/" -ForegroundColor White
    Write-Host "  2. Use Docker (recommended)" -ForegroundColor White
    Write-Host "  3. Skip Python service (NestJS handles fraud detection)" -ForegroundColor White
    Write-Host ""
    
    $choice = Read-Host "Choose option (1/2/3)"
    
    if ($choice -eq "2") {
        Write-Host ""
        Write-Host "Using Docker..." -ForegroundColor Green
        Write-Host ""
        Write-Host "Run these commands:" -ForegroundColor Cyan
        Write-Host "  cd backend/fraud-detection-service" -ForegroundColor White
        Write-Host "  docker build -t fraud-detection ." -ForegroundColor White
        Write-Host "  docker run -p 8000:8000 fraud-detection" -ForegroundColor White
        exit
    }
    elseif ($choice -eq "3") {
        Write-Host ""
        Write-Host "✅ No problem! Your NestJS backend has built-in fraud detection." -ForegroundColor Green
        Write-Host "The system works perfectly without the Python service." -ForegroundColor Green
        exit
    }
    else {
        Write-Host ""
        Write-Host "Please install Python 3.12 and run this script again." -ForegroundColor Yellow
        Write-Host "Download: https://www.python.org/downloads/" -ForegroundColor Cyan
        exit
    }
}

Write-Host "✅ Compatible Python version detected" -ForegroundColor Green
Write-Host ""

# Create virtual environment
Write-Host "Creating virtual environment..." -ForegroundColor Cyan
python -m venv venv

# Activate virtual environment and install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Cyan
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the service, run:" -ForegroundColor Cyan
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -ForegroundColor White
Write-Host ""
