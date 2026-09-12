/**
 * fileReader.js — Client-side document ingestion for the popup UI.
 * Handles PDF, DOCX, TXT, MD, JSON — all browser-native, no Node.js deps.
 */

import { extractTextFromPDF } from './pdfExtractor.js';
import { extractTextFromDocx } from './docxExtractor.js';
import { getSettings } from './storage.js';

/**
 * Read text content from an uploaded File object.
 *
 * @param {File} file
 * @returns {Promise<{ text: string, isPdfProfile: boolean }>}
 *   text — extracted raw text (or JSON-stringified profile for PDFs via backend)
 *   isPdfProfile — true when the backend returned a ready-made profile object
 */
export async function parseUploadedFile(file) {
  if (!file) throw new Error('No file provided');

  const name = file.name.toLowerCase();
  const type = file.type || '';

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    const settings = await getSettings().catch(() => ({}));
    const backendUrl = settings?.backendUrl || 'http://localhost:3000';
    const arrayBuffer = await file.arrayBuffer();
    const result = await extractTextFromPDF(arrayBuffer, backendUrl);
    // If the result looks like a JSON profile (from backend), flag it
    const isPdfProfile = result && result.startsWith('{') && result.includes('"personal"');
    return { text: result || '', isPdfProfile: !!isPdfProfile };
  }

  // ── DOCX / DOC ────────────────────────────────────────────────────────────
  if (
    name.endsWith('.docx') || name.endsWith('.doc') ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/msword'
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractTextFromDocx(arrayBuffer);
    return { text: text || '', isPdfProfile: false };
  }

  // ── TXT / MD / RTF / CSV / JSON — read as plain text ─────────────────────
  const text = await readAsText(file);
  return { text: text || '', isPdfProfile: false };
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result || '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'utf-8');
  });
}
