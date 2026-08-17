// Run via `osascript -l JavaScript`, not compiled/bundled with the TS build.
// Electron's app.getFileIcon() resolves .app bundle icons by MIME type on
// macOS and returns a generic icon instead of the bundle's real one. This
// calls the same AppKit API Finder itself uses (NSWorkspace.iconForFile) to
// get the actual icon, and writes it out as a PNG.
ObjC.import("AppKit");

function run(argv) {
  const srcPath = argv[0];
  const outPath = argv[1];

  const workspace = $.NSWorkspace.sharedWorkspace;
  const icon = workspace.iconForFile(srcPath);
  const tiffData = icon.TIFFRepresentation;
  const bitmap = $.NSBitmapImageRep.imageRepWithData(tiffData);
  const pngData = bitmap.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());

  pngData.writeToFileAtomically(outPath, true);
}
