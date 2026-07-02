<#
.SYNOPSIS
    Crée une COPIE locale (XAMPP/MariaDB) de la base de production MySQL/MariaDB
    de l'appli web, pour que le backend mobile puisse s'y connecter SANS JAMAIS
    toucher à la vraie base de prod (lecture seule via mysqldump, écriture
    uniquement dans la copie locale).

.DESCRIPTION
    1) mysqldump la base distante (prod) vers un fichier .sql
    2) Crée une base locale (XAMPP) et y importe le dump
    3) Applique migrate_copy_compat.sql (ajout colonne display_name, etc.)
    4) Affiche le DATABASE_URL à coller dans backend/.env

.EXAMPLE
    ./copy_prod_db.ps1 -SourceHost "viaduct.proxy.rlwy.net" -SourcePort 12345 `
        -SourceUser root -SourcePassword "xxxx" -SourceDatabase railway

.NOTES
    Ne JAMAIS lancer ce script avec le hostname interne Railway
    (ex: mysql.railway.internal) : il n'est PAS joignable depuis un PC hors de
    Railway. Utilise l'hôte "Public Networking" du service MySQL (onglet
    "Connect" du service dans le dashboard Railway -> "Public Network").
#>

param(
    [Parameter(Mandatory = $true)] [string]$SourceHost,
    [Parameter(Mandatory = $true)] [int]$SourcePort,
    [Parameter(Mandatory = $true)] [string]$SourceUser,
    [Parameter(Mandatory = $true)] [string]$SourcePassword,
    [Parameter(Mandatory = $true)] [string]$SourceDatabase,

    [string]$TargetDatabase = "dru_mobile_copy",
    [string]$TargetUser = "root",
    [string]$TargetPassword = "",
    [string]$TargetHost = "127.0.0.1",
    [int]$TargetPort = 3306,

    [string]$MysqlBin = "C:\xampp\mysql\bin"
)

$ErrorActionPreference = "Stop"

$mysql = Join-Path $MysqlBin "mysql.exe"
$mysqldump = Join-Path $MysqlBin "mysqldump.exe"

if (-not (Test-Path $mysql) -or -not (Test-Path $mysqldump)) {
    throw "mysql.exe / mysqldump.exe introuvables dans $MysqlBin. Adapte -MysqlBin ou démarre XAMPP."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dumpFile = Join-Path $scriptDir "prod_copy_dump.sql"
$compatFile = Join-Path $scriptDir "migrate_copy_compat.sql"

Write-Host "==> 1/4 Dump de la base distante (${SourceDatabase}@${SourceHost}:${SourcePort})..." -ForegroundColor Cyan
& $mysqldump `
    --host=$SourceHost --port=$SourcePort `
    --user=$SourceUser --password=$SourcePassword `
    --no-tablespaces --single-transaction --routines --triggers `
    $SourceDatabase | Out-File -FilePath $dumpFile -Encoding utf8

if ($LASTEXITCODE -ne 0) { throw "Echec du mysqldump (code $LASTEXITCODE)." }
Write-Host "    Dump écrit dans $dumpFile ($((Get-Item $dumpFile).Length / 1MB) MB)" -ForegroundColor Green

Write-Host "==> 2/4 Création de la base locale '$TargetDatabase' (XAMPP)..." -ForegroundColor Cyan
$createDbSql = "CREATE DATABASE IF NOT EXISTS ``$TargetDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
$createDbSql | & $mysql --host=$TargetHost --port=$TargetPort --user=$TargetUser --password=$TargetPassword
if ($LASTEXITCODE -ne 0) { throw "Echec de la création de la base locale (code $LASTEXITCODE)." }

Write-Host "==> 3/4 Import du dump dans '$TargetDatabase'..." -ForegroundColor Cyan
Get-Content $dumpFile -Raw | & $mysql --host=$TargetHost --port=$TargetPort --user=$TargetUser --password=$TargetPassword $TargetDatabase
if ($LASTEXITCODE -ne 0) { throw "Echec de l'import (code $LASTEXITCODE)." }

Write-Host "==> 4/4 Migration de compatibilité (display_name, etc.)..." -ForegroundColor Cyan
Get-Content $compatFile -Raw | & $mysql --host=$TargetHost --port=$TargetPort --user=$TargetUser --password=$TargetPassword $TargetDatabase
if ($LASTEXITCODE -ne 0) { throw "Echec de la migration de compatibilité (code $LASTEXITCODE)." }

Write-Host ""
Write-Host "Copie terminée avec succès." -ForegroundColor Green
Write-Host "Ajoute ceci dans backend/.env :" -ForegroundColor Yellow
$pwPart = if ($TargetPassword) { $TargetPassword } else { "" }
Write-Host "DATABASE_URL=mysql+pymysql://$TargetUser`:$pwPart@$TargetHost`:$TargetPort/$TargetDatabase" -ForegroundColor White
