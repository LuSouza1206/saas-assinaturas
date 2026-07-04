# Rode este arquivo no PowerShell como Administrador
# Depois reinicie o PC.

Write-Host "==> Habilitando WSL + Virtual Machine Platform..." -ForegroundColor Cyan
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Host "==> Instalando WSL..." -ForegroundColor Cyan
wsl --install --no-distribution

Write-Host ""
Write-Host "Pronto. REINICIE o PC agora." -ForegroundColor Green
Write-Host "Depois do reboot, abra o Docker Desktop." -ForegroundColor Green
pause
