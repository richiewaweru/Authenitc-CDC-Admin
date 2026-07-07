param(
	[string]$ProjectRef = 'mgaenmoeyiovwykibemg',
	[string]$FunctionName = 'request-slot-contact',
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
Write-Host "1. Submit a Request a time form from the consumer app."
Write-Host "2. Confirm staff receives the time-request email."
Write-Host "3. Confirm the member receives the acknowledgement email."
Write-Host "4. Open the admin notification panel and verify the Time requested notification links to the member profile."
