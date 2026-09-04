$ErrorActionPreference = "SilentlyContinue"

# Fast Win32 definitions
$win32Code = @"
using System;
using System.Runtime.InteropServices;

public class FastOptimizer {
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

    [DllImport("psapi.dll")]
    public static extern int EmptyWorkingSet(IntPtr hwProc);

    public static ulong GetFreeBytes() {
        MEMORYSTATUSEX mem = new MEMORYSTATUSEX();
        GlobalMemoryStatusEx(mem);
        return mem.ullAvailPhys;
    }
}
"@

try {
    Add-Type -TypeDefinition $win32Code -ErrorAction SilentlyContinue
} catch {}

$beforeFreeBytes = [FastOptimizer]::GetFreeBytes()

# Trim working sets for accessible user processes
$processes = [System.Diagnostics.Process]::GetProcesses()
$trimmedCount = 0
foreach ($proc in $processes) {
    try {
        if ($proc.Handle -and ($proc.Id -ne $PID)) {
            [FastOptimizer]::EmptyWorkingSet($proc.Handle) | Out-Null
            $trimmedCount++
        }
    } catch {}
}

# Run .NET GC Collection
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

# Small pause to allow OS pages to update
Start-Sleep -Milliseconds 250

$afterFreeBytes = [FastOptimizer]::GetFreeBytes()

$freedBytes = $afterFreeBytes - $beforeFreeBytes
$freedMB = [math]::Round($freedBytes / 1MB, 1)
if ($freedMB -lt 0) { $freedMB = 0 }
$freedGB = [math]::Round($freedMB / 1024, 2)

$result = [PSCustomObject]@{
    freedMB = $freedMB
    freedGB = $freedGB
    processesTrimmed = $trimmedCount
    timestamp = (Get-Date -Format "HH:mm:ss")
}

$result | ConvertTo-Json
