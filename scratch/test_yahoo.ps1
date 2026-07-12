# Try Yahoo Finance chart endpoint for previous close
$url = "https://query1.finance.yahoo.com/v8/finance/chart/NIFTYBEES.NS?range=2d&interval=1d"
$headers = @{
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 10
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Yahoo Finance Error: $($_.Exception.Message)"
}
