import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const CREDS_PATH = path.join(process.env.HOME || process.env.USERPROFILE || "", ".openclaw", "workspace", "google-drive-creds.json");

export async function POST(req: NextRequest) {
  try {
    const { title, rows, shareEmail } = await req.json();
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8"));
    const auth = new google.auth.OAuth2(creds.client_id, creds.client_secret);
    auth.setCredentials({ refresh_token: creds.refresh_token });

    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    // Create spreadsheet
    const response = await sheets.spreadsheets.create({
      requestBody: { properties: { title } },
    });
    const spreadsheetId = response.data.spreadsheetId!;

    // Write rows if provided
    if (rows && Array.isArray(rows) && rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        requestBody: { values: rows },
      });
    }

    // Share
    if (shareEmail) {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { role: "writer", type: "user", emailAddress: shareEmail },
      });
    } else {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { role: "writer", type: "anyone" },
      });
    }

    const shareUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`;

    return NextResponse.json({ spreadsheetId, url: response.data.spreadsheetUrl, shareUrl });
  } catch (e: unknown) {
    console.error("[create-sheet]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
