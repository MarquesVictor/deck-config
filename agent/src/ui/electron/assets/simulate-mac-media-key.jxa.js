// Run via `osascript -l JavaScript`, not compiled/bundled with the TS build.
// macOS has no shell command for "press the media key" the way AppleScript
// has `set volume`. This posts the same NX_KEYTYPE system-defined HID event
// hardware media keys generate — the technique used by most third-party
// menu-bar media control utilities. Requires the calling process (the
// packaged Agent app) to have Accessibility permission granted in System
// Settings > Privacy & Security > Accessibility.
ObjC.import("AppKit");
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
  postKey(keyCode, true);
  postKey(keyCode, false);
}

function postKey(keyCode, isDown) {
  const flags = isDown ? 0xa00 : 0xb00;
  const data1 = (keyCode << 16) | (flags << 0);
  const event = $.NSEvent.otherEventWithTypeLocationModifierFlagsTimestampWindowNumberContextSubtypeData1Data2(
    $.NSEventTypeSystemDefined,
    $.NSMakePoint(0, 0),
    isDown ? 0xa00 : 0xb00,
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
