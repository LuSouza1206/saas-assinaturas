# Rode no PowerShell como Administrador
# Para o Redis antigo do Windows (v3) que conflita com o Docker na porta 6379.

Write-Host "==> Parando servico Redis do Windows..." -ForegroundColor Cyan
Stop-Service -Name Redis -Force -ErrorAction SilentlyContinue
Set-Service -Name Redis -StartupType Disabled -ErrorAction SilentlyContinue

$svc = Get-Service -Name Redis -ErrorAction SilentlyContinue
if ($svc) {
  Write-Host "Status: $($svc.Status) | StartType: $((Get-CimInstance Win32_Service -Filter \"Name='Redis'\").StartMode)" -ForegroundColor Yellow
} else {
  Write-Host "Servico Redis nao encontrado (ok)." -ForegroundColor Green
}

Write-Host ""
Write-Host "Pronto. O Docker usa Redis 7 na porta 6380 (veja docker-compose.yml)." -ForegroundColor Green
Write-Host "REDIS_URL deve ser redis://127.0.0.1:6380" -ForegroundColor Green
pause
