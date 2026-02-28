param(
  [string]$ApiBase = "http://localhost:5000/api",
  [string]$Jwt = ""
)

if ([string]::IsNullOrWhiteSpace($Jwt)) {
  $Jwt = $env:ETNOVA_JWT
}

if ([string]::IsNullOrWhiteSpace($Jwt)) {
  Write-Host "Missing JWT. Pass -Jwt <token> or set ETNOVA_JWT environment variable." -ForegroundColor Red
  exit 1
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $url = "$ApiBase$Path"
  $headers = @{
    Authorization = "Bearer $Jwt"
  }

  try {
    if ($null -ne $Body) {
      $json = $Body | ConvertTo-Json -Depth 8
      $resp = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $url -Headers $headers -ContentType "application/json" -Body $json -TimeoutSec 20
    } else {
      $resp = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $url -Headers $headers -TimeoutSec 20
    }
    [PSCustomObject]@{
      Ok     = $true
      Status = [int]$resp.StatusCode
      Body   = $resp.Content
      Path   = $Path
      Method = $Method
    }
  } catch {
    $status = 0
    $body = ""
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
    } else {
      $body = $_.Exception.Message
    }
    [PSCustomObject]@{
      Ok     = $false
      Status = $status
      Body   = $body
      Path   = $Path
      Method = $Method
    }
  }
}

function Print-Result {
  param([object]$Result)
  $prefix = if ($Result.Ok) { "[PASS]" } else { "[FAIL]" }
  $color = if ($Result.Ok) { "Green" } else { "Red" }
  Write-Host "$prefix $($Result.Method) $($Result.Path) -> $($Result.Status)" -ForegroundColor $color
  if (-not [string]::IsNullOrWhiteSpace($Result.Body)) {
    $trim = $Result.Body
    if ($trim.Length -gt 350) { $trim = $trim.Substring(0, 350) + "..." }
    Write-Host "       $trim"
  }
}

Write-Host "ETNOVA student flow smoke test" -ForegroundColor Cyan
Write-Host "API base: $ApiBase"

$results = @()

$results += Invoke-Api -Method "GET" -Path "/profile"
$results += Invoke-Api -Method "GET" -Path "/projects"
$results += Invoke-Api -Method "GET" -Path "/join-requests/my"
$results += Invoke-Api -Method "GET" -Path "/projects/public/pending"

foreach ($r in $results) { Print-Result $r }

$projectsResp = $results | Where-Object { $_.Path -eq "/projects" } | Select-Object -First 1

if ($projectsResp.Ok -and -not [string]::IsNullOrWhiteSpace($projectsResp.Body)) {
  try {
    $projects = $projectsResp.Body | ConvertFrom-Json
    if ($projects -and $projects.Count -gt 0 -and $projects[0].id) {
      $pid = [string]$projects[0].id
      Write-Host "`nUsing project id: $pid" -ForegroundColor Yellow

      $projectChecks = @()
      $projectChecks += Invoke-Api -Method "GET" -Path "/projects/$pid"
      $projectChecks += Invoke-Api -Method "GET" -Path "/projects/$pid/team"
      $projectChecks += Invoke-Api -Method "GET" -Path "/projects/$pid/documents"
      $projectChecks += Invoke-Api -Method "GET" -Path "/projects/$pid/evaluations"

      foreach ($r in $projectChecks) { Print-Result $r }
      $results += $projectChecks
    } else {
      Write-Host "`nNo project found for this user. Project-specific checks skipped." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "`nCould not parse /projects response JSON, skipped project-specific checks." -ForegroundColor Yellow
  }
}

$failed = ($results | Where-Object { -not $_.Ok }).Count
$passed = ($results | Where-Object { $_.Ok }).Count

Write-Host "`nSummary: $passed passed, $failed failed" -ForegroundColor Cyan
if ($failed -gt 0) { exit 1 } else { exit 0 }

