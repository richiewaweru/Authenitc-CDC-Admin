param(
	[string]$ProjectRef = 'mgaenmoeyiovwykibemg',
	[string]$FunctionName = 'admin-invite-staff',
	[string]$Token = $env:SUPABASE_ACCESS_TOKEN
)

if (-not $Token) {
	Write-Error "SUPABASE_ACCESS_TOKEN is required. Set it in your environment or pass -Token."
	exit 1
}

$env:SUPABASE_ACCESS_TOKEN = $Token

Write-Host "Deploying Supabase function '$FunctionName' to project '$ProjectRef'..." -ForegroundColor Cyan
& npx --yes supabase@latest functions deploy $FunctionName --project-ref $ProjectRef

if ($LASTEXITCODE -ne 0) {
	Write-Error "Function deployment failed."
	exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Next verification steps:" -ForegroundColor Cyan
Write-Host "1. Open /guides and create a guide invite."
Write-Host "2. Confirm the recipient receives the invite email."
Write-Host "3. Open /team and verify moderator/guide resend sends a fresh invite email."
