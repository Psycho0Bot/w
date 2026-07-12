import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkRateLimit } from '@/lib/serverAuth';
import { globalRateLimiter } from '@/lib/rateLimit';
import officeCrypto from 'officecrypto-tool';
import * as XLSX from 'xlsx';

// Maximum file size: 15 MB base64 (~11 MB actual)
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  // ── Auth check ──
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // ── Rate limit ──
  const rateLimitResponse = checkRateLimit(request, globalRateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { fileData, password } = await request.json();
    if (!fileData) {
      return NextResponse.json({ error: 'File data is required' }, { status: 400 });
    }

    // Size limit to prevent DoS
    if (fileData.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 15MB.' }, { status: 413 });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Convert Base64 fileData to buffer
    const fileBuffer = Buffer.from(fileData, 'base64');

    // Decrypt the buffer using the password
    const decryptedBuffer = await officeCrypto.decrypt(fileBuffer, { password });

    // Parse the decrypted workbook
    const workbook = XLSX.read(decryptedBuffer, { type: 'buffer' });

    // Collect sheet data as 2D arrays
    const sheetsData: Record<string, string[][]> = {};
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      sheetsData[sheetName] = json;
    });

    return NextResponse.json({ sheets: sheetsData });
  } catch (err: any) {
    console.error('Error decrypting Excel file:', err);
    return NextResponse.json(
      { error: 'Failed to decrypt file. Verify password and try again.' },
      { status: 500 }
    );
  }
}
