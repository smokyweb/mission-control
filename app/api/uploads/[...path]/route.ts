import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// New location: public/uploads (served statically by Next.js, but this route handles
// the /uploads/* prefix that Next.js doesn't intercept before the API routes)
const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "uploads");
// Legacy location fallback
const LEGACY_UPLOADS = path.join(process.env.USERPROFILE || "C:\\Users\\kevin", ".openclaw", "workspace", "uploads");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".csv": "text/csv",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relativePath = segments.join("/");

  // Prevent path traversal
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");

  // Try new public/uploads location first (preserving full subpath)
  const newPath = path.join(PUBLIC_UPLOADS, normalized);
  if (fs.existsSync(newPath) && fs.statSync(newPath).isFile()) {
    const ext = path.extname(newPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const buffer = fs.readFileSync(newPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Fallback: legacy location (basename only)
  const legacyPath = path.join(LEGACY_UPLOADS, path.basename(normalized));
  if (fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile()) {
    const ext = path.extname(legacyPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const buffer = fs.readFileSync(legacyPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
