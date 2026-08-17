import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MediaCommand } from "@stream-deck/shared";

const execFileAsync = promisify(execFile);

const WM_APPCOMMAND = 0x0319;

/**
 * Win32 APPCOMMAND_* constants (winuser.h) — the same codes a hardware
 * multimedia keyboard sends. Using one mechanism (WM_APPCOMMAND) for every
 * command, including mic mute, which has no dedicated virtual-key code the
 * way volume/media transport do.
 */
const APPCOMMAND: Record<MediaCommand, number> = {
  volume_mute: 8,
  volume_down: 9,
  volume_up: 10,
  media_next: 11,
  media_previous: 12,
  media_play_pause: 14,
  mic_mute: 24,
};

/**
 * NOT independently verified — this environment has no Windows machine to
 * test against. Written from documented Win32 behavior (WM_APPCOMMAND is
 * how hardware media keys are delivered to the foreground app); needs
 * hands-on validation on real Windows.
 */
export async function runWindowsMediaCommand(command: MediaCommand): Promise<void> {
  const appCommand = APPCOMMAND[command];

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class StreamDeckMediaControl {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
}
"@
$hwnd = [StreamDeckMediaControl]::GetForegroundWindow()
$lParam = [IntPtr]((${appCommand}) -shl 16)
[StreamDeckMediaControl]::SendMessage($hwnd, ${WM_APPCOMMAND}, $hwnd, $lParam) | Out-Null
`;

  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
}
