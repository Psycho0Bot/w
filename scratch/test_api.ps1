# Test ALL user's ETFs through the WealthOS API endpoint (which now uses Yahoo Finance for previousClose)
$etfs = @(
    "NIFTYBEES.NS",
    "BANKBEES.NS",
    "SETFNIF50.NS",
    "MONQ50.NS",
    "MON100.NS",
    "MAFANG.NS",
    "MASPTOP50.NS",
    "ICICIB22.NS",
    "SETFNN50.NS",
    "MAHKTECH.NS",
    "HNGSNGBEES.NS"
)

# Angel One 24h changes from user's screenshot for comparison
$angelOneChanges = @{
    "MONQ50.NS" = "+0.51%"
    "MON100.NS" = "+0.89%"
    "MAFANG.NS" = "+0.06%"
    "MASPTOP50.NS" = "+0.00%"
    "ICICIB22.NS" = "+1.06%"
}

Write-Host "============================================================="
Write-Host "  WealthOS ETF Verification (Yahoo Finance previousClose)    "
Write-Host "============================================================="
Write-Host ""
Write-Host ("{0,-18} {1,10} {2,12} {3,10} {4,15}" -f "Ticker", "Price", "PrevClose", "Change%", "Angel One")
Write-Host ("{0,-18} {1,10} {2,12} {3,10} {4,15}" -f "------", "-----", "---------", "-------", "---------")

foreach ($ticker in $etfs) {
    $uri = "http://localhost:3000/api/market-data?type=stock&ticker=$ticker"
    try {
        $r = Invoke-RestMethod -Uri $uri -TimeoutSec 20
        $q = $r.'Global Quote'
        $price = $q.'05. price'
        $prevClose = $q.previousClose
        $changePct = $q.'10. change percent'
        $angelOne = if ($angelOneChanges[$ticker]) { $angelOneChanges[$ticker] } else { "N/A" }
        
        Write-Host ("{0,-18} {1,10} {2,12} {3,10} {4,15}" -f $ticker, $price, $prevClose, $changePct, $angelOne)
    } catch {
        Write-Host ("{0,-18} ERROR: {1}" -f $ticker, $_.Exception.Message)
    }
}

Write-Host ""
Write-Host "If Change% matches Angel One, Yahoo Finance previousClose is working correctly."
