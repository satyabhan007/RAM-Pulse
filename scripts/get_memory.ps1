$ErrorActionPreference = "SilentlyContinue"

# High performance Win32 memory status via GlobalMemoryStatusEx
$win32MemCode = @"
using System;
using System.Runtime.InteropServices;

public class WinMemFast {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public class MEMORYSTATUSEX {
        public uint dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool GlobalMemoryStatusEx([In, Out] MEMORYSTATUSEX lpBuffer);

    public static MEMORYSTATUSEX GetStatus() {
        MEMORYSTATUSEX mem = new MEMORYSTATUSEX();
        GlobalMemoryStatusEx(mem);
        return mem;
    }
}
"@

try {
    Add-Type -TypeDefinition $win32MemCode -ErrorAction SilentlyContinue
} catch {}

$mem = [WinMemFast]::GetStatus()
$totalBytes = [double]$mem.ullTotalPhys
$freeBytes = [double]$mem.ullAvailPhys
$usedBytes = $totalBytes - $freeBytes
$percentUsed = [math]::Round(($usedBytes / $totalBytes) * 100, 1)

$commitLimitBytes = [double]$mem.ullTotalPageFile
$commitAvailBytes = [double]$mem.ullAvailPageFile
$commitUsedBytes = $commitLimitBytes - $commitAvailBytes
if ($commitUsedBytes -lt 0) { $commitUsedBytes = 0 }

# Approximate standby/cached cache
$cachedBytes = $freeBytes * 0.25

# Rapid top 5 memory processes via .NET diagnostics
$topProcs = [System.Diagnostics.Process]::GetProcesses() |
    Where-Object { $_.WorkingSet64 -gt 0 } |
    Sort-Object -Property WorkingSet64 -Descending |
    Select-Object -First 5 |
    ForEach-Object {
        [PSCustomObject]@{
            name = $_.ProcessName
            pid = $_.Id
            workingSetMB = [math]::Round($_.WorkingSet64 / 1MB, 1)
        }
    }

# Status determination
$status = "OPTIMAL"
if ($percentUsed -ge 85) {
    $status = "CRITICAL"
} elseif ($percentUsed -ge 70) {
    $status = "MODERATE"
}

$result = [PSCustomObject]@{
    totalRamGB = [math]::Round($totalBytes / 1GB, 2)
    usedRamGB = [math]::Round($usedBytes / 1GB, 2)
    freeRamGB = [math]::Round($freeBytes / 1GB, 2)
    percentUsed = $percentUsed
    cachedGB = [math]::Round($cachedBytes / 1GB, 2)
    commitTotalGB = [math]::Round($commitLimitBytes / 1GB, 2)
    commitUsedGB = [math]::Round($commitUsedBytes / 1GB, 2)
    status = $status
    topProcesses = $topProcs
    timestamp = (Get-Date -Format "HH:mm:ss")
}

$result | ConvertTo-Json -Depth 3
