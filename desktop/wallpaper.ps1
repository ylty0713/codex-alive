param([string]$Handle,[int]$X=0,[int]$Y=0,[int]$Width=0,[int]$Height=0)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RinDesktopHost {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string c,string t);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr p,IntPtr after,string c,string t);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb,IntPtr p);
  [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr h,uint msg,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
  [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetParent(IntPtr child,IntPtr parent);
  [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr h,int n);
  [DllImport("user32.dll",EntryPoint="SetWindowLongPtrW")] static extern IntPtr SetWindowLongPtr(IntPtr h,int n,IntPtr v);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h,out Rect r);
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern int MapWindowPoints(IntPtr from,IntPtr to,ref Point point,uint count);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
  [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h,int attr,ref int value,int size);
  [StructLayout(LayoutKind.Sequential)] struct Point {public int x,y;}
  [StructLayout(LayoutKind.Sequential)] struct Rect {public int left,top,right,bottom;}
  public static string Attach(long handle,int x,int y,int width,int height) {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    IntPtr prog=FindWindow("Progman",null), result;
    if(prog==IntPtr.Zero) throw new Exception("Windows desktop is not available.");
    SendMessageTimeout(prog,0x052c,IntPtr.Zero,IntPtr.Zero,2,1500,out result);
    IntPtr worker=IntPtr.Zero;
    EnumWindows((h,p)=>{
      if(FindWindowEx(h,IntPtr.Zero,"SHELLDLL_DefView",null)!=IntPtr.Zero) worker=FindWindowEx(IntPtr.Zero,h,"WorkerW",null);
      return true;
    },IntPtr.Zero);
    // Some Windows 11 versions keep the backdrop WorkerW inside Progman.
    if(worker==IntPtr.Zero) worker=FindWindowEx(prog,IntPtr.Zero,"WorkerW",null);
    if(worker==IntPtr.Zero) throw new Exception("No wallpaper host was found. The preview remains available.");
    IntPtr child=new IntPtr(handle);
    long style=GetWindowLongPtr(child,-16).ToInt64();
    SetWindowLongPtr(child,-16,new IntPtr((style & ~0x80CF0000L)|0x40000000L));
    long ex=GetWindowLongPtr(child,-20).ToInt64();
    SetWindowLongPtr(child,-20,new IntPtr(ex & ~0x00020300L));
    int square=1;DwmSetWindowAttribute(child,33,ref square,4);
    SetParent(child,worker);
    if(GetParent(child)!=worker) throw new Exception("Could not attach the wallpaper window.");
    Rect r;GetClientRect(worker,out r);
    Point point=new Point{x=x,y=y};MapWindowPoints(IntPtr.Zero,worker,ref point,1);
    if(width<=0||height<=0){width=r.right-r.left;height=r.bottom-r.top;point.x=0;point.y=0;}
    if(!SetWindowPos(child,IntPtr.Zero,point.x,point.y,width,height,0x0040|0x0010|0x0020))throw new Exception("Could not position wallpaper.");
    Rect actual;GetWindowRect(child,out actual);
    Rect client;GetClientRect(child,out client);Point origin=new Point{x=0,y=0};MapWindowPoints(child,IntPtr.Zero,ref origin,1);
    return "{\"parent\":\""+worker.ToInt64()+"\",\"x\":"+actual.left+",\"y\":"+actual.top+",\"width\":"+(actual.right-actual.left)+",\"height\":"+(actual.bottom-actual.top)+",\"clientX\":"+origin.x+",\"clientY\":"+origin.y+",\"clientWidth\":"+(client.right-client.left)+",\"clientHeight\":"+(client.bottom-client.top)+"}";
  }
}
'@
[RinDesktopHost]::Attach([long]$Handle,$X,$Y,$Width,$Height)
