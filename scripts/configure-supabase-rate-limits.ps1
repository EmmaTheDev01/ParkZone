[CmdletBinding()]
param(
    [ValidateRange(1, 1000)]
    [int]$AnonymousUsers = 10,

    [ValidateRange(1, 1000)]
    [int]$EmailSent = 3,

    [ValidateRange(1, 1000)]
    [int]$SmsSent = 10,

    [ValidateRange(1, 1000)]
    [int]$Verify = 10,

    [ValidateRange(1, 1000)]
    [int]$TokenRefresh = 10,

    [ValidateRange(1, 1000)]
    [int]$Otp = 3,

    [ValidateRange(1, 1000)]
    [int]$Web3 = 10
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
    throw "Set SUPABASE_ACCESS_TOKEN in this terminal before running this script."
}

if ([string]::IsNullOrWhiteSpace($env:PROJECT_REF)) {
    throw "Set PROJECT_REF in this terminal before running this script."
}

$uri = "https://api.supabase.com/v1/projects/$env:PROJECT_REF/config/auth"
$headers = @{ Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN" }

Write-Host "Current Supabase Auth rate limits:"
$currentConfig = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
$currentConfig.PSObject.Properties |
    Where-Object { $_.Name -like "rate_limit_*" } |
    Select-Object Name, Value |
    Format-Table -AutoSize

$body = @{
    rate_limit_anonymous_users = $AnonymousUsers
    rate_limit_sms_sent = $SmsSent
    rate_limit_verify = $Verify
    rate_limit_token_refresh = $TokenRefresh
    rate_limit_otp = $Otp
    rate_limit_web3 = $Web3
} | ConvertTo-Json

Invoke-RestMethod -Method Patch -Uri $uri -Headers $headers -ContentType "application/json" -Body $body | Out-Null

Write-Host "Supabase Auth rate limits updated."