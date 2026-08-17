// Run via `osascript -l JavaScript`, not compiled/bundled with the TS build.
// macOS has no shell command for "press the media key" the way AppleScript
// has `set volume`. This posts the same NX_KEYTYPE system-defined HID event
// hardware media keys generate — the technique used by most third-party
// menu-bar media control utilities.
//
// This requires Accessibility permission for the calling process (System
// Settings > Privacy & Security > Accessibility). Without it, CGEventPost
// doesn't throw or fail — it just silently drops the event, which is worse
// than an error, so AXIsProcessTrusted() is checked first and a real error
// is thrown when it's false.
//
// AXIsProcessTrustedWithOptions() (the variant that can trigger the native
// permission-request dialog automatically) segfaulted when constructing its
// options dictionary through this JS-ObjC bridge — not used here. The user
// has to grant this manually.
ObjC.import("AppKit");
ObjC.import("ApplicationServices");
ObjC.import("CoreGraphics");

// NX_KEYTYPE_* constants (Events.h)
const KEY_CODES = {
  play_pause: 16,
  next: 17,
  previous: 18,
};

function run(argv) {
  const which = argv[0];
  const keyCode = KEY_CODES[which];
  if (keyCode === undefined) {
    throw new Error(`Unknown media key: ${which}`);
  }

  if (!$.AXIsProcessTrusted()) {
    throw new Error(
      "Permissão de Acessibilidade necessária. Ative em Ajustes do Sistema > Privacidade e Segurança > Acessibilidade.",
    );
  }

  postKey(keyCode, true);
  postKey(keyCode, false);
}

function postKey(keyCode, isDown) {
  const flags = isDown ? 0xa00 : 0xb00;
  const data1 = (keyCode << 16) | flags;
  const event = $.NSEvent.otherEventWithTypeLocationModifierFlagsTimestampWindowNumberContextSubtypeData1Data2(
    $.NSEventTypeSystemDefined,
    $.NSMakePoint(0, 0),
    flags,
    0,
    0,
    $(),
    8,
    data1,
    -1,
  );
  const cgEvent = event.CGEvent;
  $.CGEventPost($.kCGSessionEventTap, cgEvent);
}
