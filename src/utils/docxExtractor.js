/**
 * docxExtractor.js — Browser-native DOCX text extraction.
 * Uses JSZip (already a dependency, works in browser) to unzip the .docx
 * and parse word/document.xml directly.
 * No mammoth, no Node.js dependencies.
 */

import JSZip from 'jszip';

/**
 * Convert XML text nodes to plain text, preserving paragraph breaks.
 */
function xmlToText(xml) {
  if (!xml) return '';

  let text = xml
    // Paragraph breaks
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<w:p\/>/g, '\n')
    // Tab characters
    .replace(/<w:tab[^/]*/g, '\t')
    // Line breaks
    .replace(/<w:br[^/]*/g, '\n')
    // Extract text from <w:t> tags (the actual text content in DOCX)
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
    // Remove all remaining XML tags
    .replace(/<[^>]+>/g, '')
    // Decode XML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Extract text from a .docx ArrayBuffer using JSZip.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function extractTextFromDocx(arrayBuffer) {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    const parts = [];

    // Main document body
    const docXml = zip.file('word/document.xml');
    if (docXml) {
      const xml = await docXml.async('string');
      const text = xmlToText(xml);
      if (text) parts.push(text);
    }

    // Headers
    const headerFiles = Object.keys(zip.files).filter(f => /word\/header\d*\.xml/.test(f));
    for (const hf of headerFiles) {
      const xml = await zip.file(hf).async('string');
      const text = xmlToText(xml);
      if (text && text.trim()) parts.push(text);
    }

    // Footers
    const footerFiles = Object.keys(zip.files).filter(f => /word\/footer\d*\.xml/.test(f));
    for (const ff of footerFiles) {
      const xml = await zip.file(ff).async('string');
      const text = xmlToText(xml);
      if (text && text.trim()) parts.push(text);
    }

    return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

  } catch (err) {
    console.warn('[FillX] DOCX extraction error:', err.message);
    return '';
  }
}
