/**
 * fileReader.js — Client-Side Document Ingestion for Popup UI
 *
 * Handles file reading for PDF (.pdf), Word (.docx, .doc), Markdown (.md),
 * Text (.txt), and JSON (.json) files.
 * Bundled by Vite into the extension popup.
 */

import { extractTextFromPDF } from './pdfExtractor.js';
import { extractTextFromDocx } from './docxExtractor.js';

/**
 * Reads the text content from an uploaded File.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function parseUploadedFile(file) {
  if (!file) throw new Error('No file provided');

  const fileName = file.name.toLowerCase();

  // 1. PDF files (.pdf)
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdfText = await extractTextFromPDF(arrayBuffer);
    if (pdfText && pdfText.length > 10) {
      return pdfText;
    }
  }

  // 2. Word documents (.docx, .doc)
  if (
    fileName.endsWith('.docx') ||
    fileName.endsWith('.doc') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/msword'
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const docxText = await extractTextFromDocx(arrayBuffer);
    if (docxText && docxText.length > 10) {
      return docxText;
    }
  }

  // 3. Plain text, Markdown, JSON, CSV
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || '');
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}
