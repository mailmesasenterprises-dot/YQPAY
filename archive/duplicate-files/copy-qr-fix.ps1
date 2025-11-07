# Quick Deploy Script - Copy QR Code Fixes to USB/Network Drive
# Run this on the SOURCE PC (192.168.1.6)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  QR Code Fix - File Copy Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Set source directory
$sourceDir = "d:\YQPAY\10 - Copy"

# Files to copy
$files = @(
    "backend\utils\singleQRGenerator.js",
    "backend\utils\qrCodeGenerator.js",
    "backend\.env"
)

# Ask for destination (USB drive or network path)
Write-Host "Where do you want to copy the files?" -ForegroundColor Yellow
Write-Host "Examples:" -ForegroundColor Gray
Write-Host "  E:\QR-FIX          (USB Drive)" -ForegroundColor Gray
Write-Host "  \\SERVER\Share     (Network)" -ForegroundColor Gray
Write-Host ""

$destination = Read-Host "Enter destination path"

# Create destination folder
$destFolder = Join-Path $destination "QR-FIX-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force -Path $destFolder | Out-Null

Write-Host ""
Write-Host "Copying files to: $destFolder" -ForegroundColor Green
Write-Host ""

# Copy each file
foreach ($file in $files) {
    $sourcePath = Join-Path $sourceDir $file
    $destPath = Join-Path $destFolder $file
    
    # Create subdirectories if needed
    $destDir = Split-Path $destPath -Parent
    if (!(Test-Path $destDir)) {
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }
    
    # Copy file
    Copy-Item -Path $sourcePath -Destination $destPath -Force
    Write-Host "  [OK] $file" -ForegroundColor Green
}

# Create instruction file
$instructions = @"
QR CODE FIX - INSTALLATION INSTRUCTIONS
========================================

FILES IN THIS FOLDER:
1. backend\utils\singleQRGenerator.js
2. backend\utils\qrCodeGenerator.js
3. backend\.env

HOW TO INSTALL ON EACH PC:
---------------------------

1. COPY FILES:
   Copy all files from this folder to:
   d:\YQPAY\10 - Copy\
   
   (Keep the same folder structure!)

2. STOP BACKEND:
   Open PowerShell and run:
   taskkill /F /IM node.exe

3. START BACKEND:
   cd "d:\YQPAY\10 - Copy\backend"
   npm run dev

4. VERIFY:
   Check server logs for:
   "QR codes will use: https://yqpay-78918378061.us-central1.run.app"

WHAT WAS FIXED:
---------------
- QR codes now ALWAYS use Google Cloud URL
- Network IP (192.168.x.x) is DISABLED
- localhost is DISABLED
- Works on ALL 100+ systems!

QUESTIONS?
----------
See: DEPLOY-QR-FIX-TO-ALL-PCS.md

Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@

$instructions | Out-File -FilePath (Join-Path $destFolder "README.txt") -Encoding UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  COPY COMPLETE!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files copied to: $destFolder" -ForegroundColor Yellow
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "1. Take the USB drive / access network folder" -ForegroundColor White
Write-Host "2. Go to each PC" -ForegroundColor White
Write-Host "3. Copy files from:" -ForegroundColor White
Write-Host "   $destFolder" -ForegroundColor Gray
Write-Host "4. Paste to:" -ForegroundColor White
Write-Host "   d:\YQPAY\10 - Copy\" -ForegroundColor Gray
Write-Host "5. Restart backend server on each PC" -ForegroundColor White
Write-Host ""
Write-Host "See README.txt in the copied folder for detailed instructions." -ForegroundColor Yellow
Write-Host ""

# Open destination folder
Write-Host "Opening destination folder..." -ForegroundColor Green
Start-Process "explorer.exe" -ArgumentList $destFolder

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
