/**
 * pdfExtractor.js — Browser-native PDF text extraction.
 * 
 * Strategy:
 * 1. Convert PDF to base64 and send to backend (Gemini reads PDF natively) — BEST quality
 * 2. If backend unavailable: parse raw PDF byte stream for embedded text — FALLBACK
 * 
 * No pdfjs-dist, no workers, no Node.js dependencies.
 */

/**
 * Convert ArrayBuffer to base64 string (browser-native, no btoa size limit).
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Send PDF as base64 to the backend /api/extract which uses Gemini to read it natively.
 * This is the highest-quality path — Gemini understands PDF structure perfectly.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} backendUrl
 * @returns {Promise<string|null>} extracted text or null if backend unavailable
 */
async function extractViaBacked(arrayBuffer, backendUrl = 'http://localhost:3000') {
  try {
    const base64 = arrayBufferToBase64(arrayBuffer);
    const res = await fetch(`${backendUrl}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64: base64, mimeType: 'application/pdf' }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Backend returns a structured profile — serialize it back to text for mergeProfile
    if (data.profile) return JSON.stringify(data.profile);
    return null;
  } catch {
    return null;
  }
}

/**
 * Raw PDF byte-stream text extraction — fallback when backend is offline.
 * Parses PDF content streams looking for text operators (Tj, TJ, BT/ET blocks).
 * Not perfect but handles most standard PDFs.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {string}
 */
function extractFromPDFBytes(arrayBuffer) {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(bytes);

    const textParts = [];

    // Extract text from BT...ET blocks (standard PDF text blocks)
    const btEtRegex = /BT([\s\S]*?)ET/g;
    let match;
    while ((match = btEtRegex.exec(raw)) !== null) {
      const block = match[1];

      // Tj operator: (text)Tj
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        const text = decodePDFString(tjMatch[1]);
        if (text.trim()) textParts.push(text);
      }

      // TJ operator: [(text1) spacing (text2)]TJ
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      let tjArrMatch;
      while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
        const inner = tjArrMatch[1];
        const strRegex = /\(([^)]*)\)/g;
        let strMatch;
        const parts = [];
        while ((strMatch = strRegex.exec(inner)) !== null) {
          const text = decodePDFString(strMatch[1]);
          if (text.trim()) parts.push(text);
        }
        if (parts.length) textParts.push(parts.join(''));
      }
    }

    // Also try to extract raw printable text as last resort
    if (textParts.length < 5) {
      const printable = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const meaningful = printable.split(/\s+/).filter(w => w.length > 2 && /[a-zA-Z]/.test(w));
      if (meaningful.length > 20) {
        textParts.push(meaningful.join(' '));
      }
    }

    return textParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  } catch {
    return '';
  }
}

function decodePDFString(str) {
  // Handle PDF octal escapes like \123
  return str
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
    .replace(/\\[()]/g, m => m[1]);
}

/**
 * Main export — tries backend first (Gemini), falls back to byte parsing.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} [backendUrl]
 * @returns {Promise<string>}
 */
export async function extractTextFromPDF(arrayBuffer, backendUrl) {
  // Try Gemini via backend first — returns JSON stringified profile
  const backendResult = await extractViaBacked(arrayBuffer, backendUrl);
  if (backendResult && backendResult.length > 10) {
    return backendResult;
  }
  // Fallback: raw byte extraction
  return extractFromPDFBytes(arrayBuffer);
}
