import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MediaCommand, VolumeState } from "@stream-deck/shared";

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

/**
 * IAudioEndpointVolume/IMMDeviceEnumerator COM interop (endpointvolume.h,
 * mmdeviceapi.h) — there's no simpler built-in Windows command for reading
 * or setting an absolute master volume level. The interface method lists
 * below are declared in full, in their real vtable order (including the
 * methods this code never calls), since COM interop dispatch here is
 * positional: leaving one out would silently shift every method after it
 * onto the wrong function.
 *
 * NOT independently verified — this environment has no Windows machine to
 * test against.
 */
const AUDIO_ENDPOINT_VOLUME_TYPE = `
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int NotImpl1();
    int NotImpl2();
    int GetChannelCount(out uint pnChannelCount);
    int SetMasterVolumeLevel(float fLevelDB, Guid pguidEventContext);
    int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
    int GetMasterVolumeLevel(out float pfLevelDB);
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, Guid pguidEventContext);
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, Guid pguidEventContext);
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
    int VolumeStepUp(Guid pguidEventContext);
    int VolumeStepDown(Guid pguidEventContext);
    int QueryHardwareSupport(out uint pdwHardwareSupportMask);
    int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref Guid iid, uint dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int NotImpl1();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumeratorComObject { }

public class StreamDeckAudioEndpoint {
    static IAudioEndpointVolume GetVolumeInterface() {
        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
        IMMDevice device;
        // eRender = 0 (playback devices), eMultimedia = 1 (default role for general playback).
        enumerator.GetDefaultAudioEndpoint(0, 1, out device);
        var iid = typeof(IAudioEndpointVolume).GUID;
        object epv;
        device.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out epv);
        return (IAudioEndpointVolume)epv;
    }

    public static float GetVolumeScalar() {
        float level;
        GetVolumeInterface().GetMasterVolumeLevelScalar(out level);
        return level;
    }

    public static void SetVolumeScalar(float level) {
        GetVolumeInterface().SetMasterVolumeLevelScalar(level, Guid.Empty);
    }

    public static bool GetMuted() {
        bool muted;
        GetVolumeInterface().GetMute(out muted);
        return muted;
    }
}
`;

async function runAudioEndpointScript(tail: string): Promise<string> {
  const script = `Add-Type @"\n${AUDIO_ENDPOINT_VOLUME_TYPE}\n"@\n${tail}`;
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  return stdout.trim();
}

export async function getWindowsVolume(): Promise<VolumeState> {
  const output = await runAudioEndpointScript(
    '"$([StreamDeckAudioEndpoint]::GetVolumeScalar())|$([StreamDeckAudioEndpoint]::GetMuted())"',
  );
  const [volumeStr, mutedStr] = output.split("|");
  return { volume: Math.round(Number(volumeStr) * 100), muted: mutedStr?.trim().toLowerCase() === "true" };
}

export async function setWindowsVolume(volume: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, volume)) / 100;
  await runAudioEndpointScript(`[StreamDeckAudioEndpoint]::SetVolumeScalar(${clamped})`);
}
