# 🪟 Move and resize only the test application's native window.
param([Parameter(Mandatory)][string]$Title, [ValidateSet('resize','maximize','restore','close','click')][string]$Action='resize', [Parameter(Mandatory)][int]$ProcessId, [int]$Width=1000, [int]$Height=720, [string]$Control="")
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public static class OWGuideWindowTest {
  private delegate bool EnumCallback(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr h, EnumCallback callback, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumCallback callback, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr h, StringBuilder text, int count);
  public static IntPtr FindOwned(string title, uint processId) {
    IntPtr found=IntPtr.Zero;
    EnumWindows((h,l)=>{
      uint owner; GetWindowThreadProcessId(h,out owner);
      if (owner!=processId) return true;
      var text=new StringBuilder(512); GetWindowText(h,text,text.Capacity);
      if (text.ToString().Trim()!=title.Trim()) return true;
      found=h;return false;
    },IntPtr.Zero);
    return found;
  }
  public static IntPtr FindControl(IntPtr window, string name) {
    IntPtr found=IntPtr.Zero;
    EnumChildWindows(window,(h,l)=>{
      var text=new StringBuilder(512);GetWindowText(h,text,text.Capacity);
      if (text.ToString().Replace("&", "").Trim()!=name || !IsWindowEnabled(h)) return true;
      found=h;return false;
    },IntPtr.Zero);
    return found;
  }
  public static string ControlTitles(IntPtr window) {
    var titles=new List<string>();
    EnumChildWindows(window,(h,l)=>{
      var text=new StringBuilder(512);GetWindowText(h,text,text.Capacity);
      if (text.Length>0) titles.Add(text.ToString()+" [enabled="+IsWindowEnabled(h)+"]");
      return true;
    },IntPtr.Zero);
    return string.Join(" | ",titles);
  }
  public static string OwnedTitles(uint processId) {
    var titles=new List<string>();
    EnumWindows((h,l)=>{
      uint owner; GetWindowThreadProcessId(h,out owner);
      if (owner==processId) { var text=new StringBuilder(512);GetWindowText(h,text,text.Capacity);titles.Add(text.ToString()); }
      return true;
    },IntPtr.Zero);
    return string.Join(" | ",titles);
  }
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int height, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int command);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
}
'@
$h=[OWGuideWindowTest]::FindOwned($Title,$ProcessId)
if ($h -eq [IntPtr]::Zero) { throw "Native window not found: $Title. Owned titles: $([OWGuideWindowTest]::OwnedTitles($ProcessId))" }
[uint32]$windowProcess=0
[OWGuideWindowTest]::GetWindowThreadProcessId($h,[ref]$windowProcess) | Out-Null
if ($windowProcess -ne $ProcessId) { throw "Refusing to change another process's window." }
switch ($Action) {
  'click' {
    if (!$Control) { throw 'A named control is required.' }
    $button=[OWGuideWindowTest]::FindControl($h,$Control)
    if ($button -eq [IntPtr]::Zero) { throw "Enabled control not found: $Control. Controls: $([OWGuideWindowTest]::ControlTitles($h))" }
    [OWGuideWindowTest]::SetForegroundWindow($h) | Out-Null
    [OWGuideWindowTest]::SendMessage($button,0x00F5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
  }
  'resize' { if (![OWGuideWindowTest]::SetWindowPos($h,[IntPtr]::Zero,40,40,$Width,$Height,0x0004)) { throw 'Native resize failed.' } }
  'maximize' { [OWGuideWindowTest]::ShowWindow($h,3) | Out-Null }
  'restore' { [OWGuideWindowTest]::ShowWindow($h,9) | Out-Null }
  'close' { if (![OWGuideWindowTest]::PostMessage($h,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)) { throw 'Native close failed.' } }
}
