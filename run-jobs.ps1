
<#
.SYNOPSIS
    Manually trigger background jobs for LexyHub

.DESCRIPTION
    This script allows you to manually trigger background jobs without access to the admin backend.
    Requires Supabase service role key for authentication.

.PARAMETER Job
    Specify which job to run. Options:
    - corpus-all (default): Run all AI corpus ingestion jobs
    - corpus-metrics: Ingest metrics to corpus
    - corpus-predictions: Ingest predictions to corpus
    - corpus-risks: Ingest risks to corpus
    - social-metrics: Aggregate social metrics
    - ingest-metrics: Collect keyword metrics
    - intent-classify: Classify keyword intents
    - rebuild-clusters: Rebuild semantic clusters
    - embed-missing: Generate missing embeddings
    - trend-aggregation: Aggregate trends
    - keyword-telemetry: Collapse keyword events
    - dataforseo: Trigger DataForSEO ingestion

.PARAMETER BaseUrl
    The base URL of your application. Defaults to http://localhost:3000

.PARAMETER ServiceKey
    The Supabase service role key. If not provided, will read from SUPABASE_SERVICE_KEY environment variable.

.EXAMPLE
    # Run all corpus jobs (requires environment variable)
    .\run-jobs.ps1

.EXAMPLE
    # Run all corpus jobs with explicit parameters
    .\run-jobs.ps1 -Job corpus-all -BaseUrl "https://your-app.com" -ServiceKey "your-key"

.EXAMPLE
    # Run specific job
    .\run-jobs.ps1 -Job corpus-metrics

.EXAMPLE
    # Run with environment variables
    $env:SUPABASE_SERVICE_KEY = "your-service-key"
    $env:BASE_URL = "https://your-app.com"
    .\run-jobs.ps1 -Job corpus-risks
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet(
        'corpus-all',
        'corpus-metrics',
        'corpus-predictions',
        'corpus-risks',
        'social-metrics',
        'ingest-metrics',
        'intent-classify',
        'rebuild-clusters',
        'embed-missing',
        'trend-aggregation',
        'keyword-telemetry',
        'dataforseo'
    )]
    [string]$Job = 'corpus-all',

    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = $env:BASE_URL,

    [Parameter(Mandatory=$false)]
    [string]$ServiceKey = $env:SUPABASE_SERVICE_KEY
)

# Set defaults
if ([string]::IsNullOrEmpty($BaseUrl)) {
    $BaseUrl = "http://localhost:3000"
}

# Validate service key
if ([string]::IsNullOrEmpty($ServiceKey)) {
    Write-Host "ERROR: Supabase service key is required!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Set it via parameter or environment variable:" -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_SERVICE_KEY = "your-service-key"' -ForegroundColor Cyan
    Write-Host "  .\run-jobs.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "OR" -ForegroundColor Yellow
    Write-Host ""
    Write-Host '  .\run-jobs.ps1 -ServiceKey "your-service-key"' -ForegroundColor Cyan
    exit 1
}

# Job endpoint mappings
$JobEndpoints = @{
    'corpus-all' = '/api/jobs/ingest-corpus/all'
    'corpus-metrics' = '/api/jobs/ingest-corpus/metrics'
    'corpus-predictions' = '/api/jobs/ingest-corpus/predictions'
    'corpus-risks' = '/api/jobs/ingest-corpus/risks'
    'social-metrics' = '/api/jobs/social-metrics'
    'ingest-metrics' = '/api/jobs/ingest-metrics'
    'intent-classify' = '/api/jobs/intent-classify'
    'rebuild-clusters' = '/api/jobs/rebuild-clusters'
    'embed-missing' = '/api/jobs/embed-missing'
    'trend-aggregation' = '/api/jobs/trend-aggregation'
    'keyword-telemetry' = '/api/jobs/keyword-telemetry'
    'dataforseo' = '/api/jobs/dataforseo/trigger'
}

# Job descriptions
$JobDescriptions = @{
    'corpus-all' = 'Running all AI corpus ingestion jobs sequentially'
    'corpus-metrics' = 'Ingesting keyword metrics to AI corpus'
    'corpus-predictions' = 'Ingesting predictions to AI corpus'
    'corpus-risks' = 'Ingesting risk rules and events to AI corpus'
    'social-metrics' = 'Aggregating social metrics'
    'ingest-metrics' = 'Collecting keyword metrics'
    'intent-classify' = 'Classifying keyword intents'
    'rebuild-clusters' = 'Rebuilding semantic clusters'
    'embed-missing' = 'Generating missing embeddings'
    'trend-aggregation' = 'Aggregating trend data'
    'keyword-telemetry' = 'Collapsing keyword events to stats'
    'dataforseo' = 'Triggering DataForSEO ingestion'
}

function Invoke-BackgroundJob {
    param(
        [string]$Endpoint,
        [string]$Description
    )

    $url = "$BaseUrl$Endpoint"
    $headers = @{
        'Authorization' = "Bearer $ServiceKey"
        'Content-Type' = 'application/json'
    }

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host " $Description" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "Endpoint: $Endpoint" -ForegroundColor Gray
    Write-Host "URL: $url" -ForegroundColor Gray
    Write-Host ""

    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body '{}' -ErrorAction Stop

        Write-Host "✓ Job completed successfully" -ForegroundColor Green
        Write-Host ""
        Write-Host "Response:" -ForegroundColor White

        # Pretty print JSON response
        $jsonOutput = $response | ConvertTo-Json -Depth 10
        $jsonOutput | Write-Host -ForegroundColor Gray

        return $response
    }
    catch {
        Write-Host "✗ Job failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error Details:" -ForegroundColor Yellow
        Write-Host $_.Exception.Message -ForegroundColor Red

        if ($_.ErrorDetails.Message) {
            Write-Host ""
            Write-Host "Server Response:" -ForegroundColor Yellow
            try {
                $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json | ConvertTo-Json -Depth 10
                Write-Host $errorJson -ForegroundColor Red
            }
            catch {
                Write-Host $_.ErrorDetails.Message -ForegroundColor Red
            }
        }

        return $null
    }
}

# Display configuration
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║            LexyHub Background Job Runner                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor White
Write-Host "  Base URL: " -NoNewline -ForegroundColor Gray
Write-Host $BaseUrl -ForegroundColor Cyan
Write-Host "  Service Key: " -NoNewline -ForegroundColor Gray
Write-Host "$($ServiceKey.Substring(0, 20))..." -ForegroundColor Cyan
Write-Host "  Job: " -NoNewline -ForegroundColor Gray
Write-Host $Job -ForegroundColor Cyan
Write-Host ""

# Execute the job
$endpoint = $JobEndpoints[$Job]
$description = $JobDescriptions[$Job]

if ([string]::IsNullOrEmpty($endpoint)) {
    Write-Host "ERROR: Unknown job '$Job'" -ForegroundColor Red
    exit 1
}

$startTime = Get-Date
$result = Invoke-BackgroundJob -Endpoint $endpoint -Description $description
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

# Display summary
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Summary" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($result -and $result.success) {
    Write-Host "Status: " -NoNewline -ForegroundColor Gray
    Write-Host "SUCCESS ✓" -ForegroundColor Green

    if ($result.processed) {
        Write-Host "Processed: " -NoNewline -ForegroundColor Gray
        Write-Host $result.processed -ForegroundColor Cyan
    }

    if ($result.successCount) {
        Write-Host "Success Count: " -NoNewline -ForegroundColor Gray
        Write-Host $result.successCount -ForegroundColor Green
    }

    if ($result.errorCount) {
        Write-Host "Error Count: " -NoNewline -ForegroundColor Gray
        Write-Host $result.errorCount -ForegroundColor Yellow
    }

    if ($result.totalSuccess) {
        Write-Host "Total Success: " -NoNewline -ForegroundColor Gray
        Write-Host $result.totalSuccess -ForegroundColor Green
    }

    if ($result.duration) {
        Write-Host "Job Duration: " -NoNewline -ForegroundColor Gray
        Write-Host "$([math]::Round($result.duration / 1000, 2))s" -ForegroundColor Cyan
    }
}
else {
    Write-Host "Status: " -NoNewline -ForegroundColor Gray
    Write-Host "FAILED ✗" -ForegroundColor Red
}

Write-Host "Total Execution Time: " -NoNewline -ForegroundColor Gray
Write-Host "$([math]::Round($duration, 2))s" -ForegroundColor Cyan
Write-Host ""

# Exit with appropriate code
if ($result -and $result.success) {
    exit 0
}
else {
    exit 1
}
