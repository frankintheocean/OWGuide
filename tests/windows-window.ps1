# 🪟 Move and resize only the test application's native window.
param([Parameter(Mandatory)][string]$Title, [ValidateSet('resize','maximize','restore','close')][string]$Action='resize', [Parameter(Mandatory)][int]$ProcessId, [int]$Width=1000, [int]$Height=720)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OWGuideWindowTest {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string title);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int height, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int command);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
}
'@
$h=[OWGuideWindowTest]::FindWindow($null,$Title)
if ($h -eq [IntPtr]::Zero) { throw "Native window not found: $Title" }
[uint32]$windowProcess=0
[OWGuideWindowTest]::GetWindowThreadProcessId($h,[ref]$windowProcess) | Out-Null
if ($windowProcess -ne $ProcessId) { throw "Refusing to change another process's window." }
switch ($Action) {
  'resize' { if (![OWGuideWindowTest]::SetWindowPos($h,[IntPtr]::Zero,40,40,$Width,$Height,0x0004)) { throw 'Native resize failed.' } }
  'maximize' { [OWGuideWindowTest]::ShowWindow($h,3) | Out-Null }
  'restore' { [OWGuideWindowTest]::ShowWindow($h,9) | Out-Null }
  'close' { if (![OWGuideWindowTest]::PostMessage($h,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)) { throw 'Native close failed.' } }
}
