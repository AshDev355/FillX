/**
 * docxExtractor.js — Client-Side DOCX Word Document Parser
 *
 * Extracts text from Microsoft Word (.docx / .doc) documents using
 * Mammoth (with table & heading preservation) and JSZip direct XML traversal.
 */

import mammoth from 'mammoth';
import JSZip from 'jszip';

function htmlToFormattedText(html) {
  if (!html) return '';

  return html
    // Table rows & cells
    .replace(/<tr[^>]*>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<th[^>]*>/gi, ' | ')
    .replace(/<\/td>|<\/th>/gi, '')
    .replace(/<\/tr>/gi, ' |')
    .replace(/<\/table>/gi, '\n\n')
    // Headings
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n')
    // Paragraphs & list items
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // HTML entity decoding
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Normalize newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts structured plain text from a DOCX ArrayBuffer.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function extractTextFromDocx(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return '';
  }

  // 1. Primary extractor: Mammoth convertToHtml for structure preservation (tables, headings, lists)
  try {
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    if (htmlResult && htmlResult.value) {
      const formatted = htmlToFormattedText(htmlResult.value);
      if (formatted.length >= 10) {
        return formatted;
      }
    }

    const rawResult = await mammoth.extractRawText({ arrayBuffer });
    if (rawResult && rawResult.value && rawResult.value.trim().length >= 10) {
      return rawResult.value.trim();
    }
  } catch (err) {
    console.warn('FillX: Mammoth DOCX parser notice, trying JSZip fallback:', err);
  }

  // 2. Secondary fallback extractor: JSZip direct XML traversal
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (docXmlFile) {
      const xmlText = await docXmlFile.async('string');
      const text = xmlText
        // Tables: rows and cells
        .replace(/<w:tr[^>]*>/g, '\n')
        .replace(/<w:tc[^>]*>/g, ' | ')
        .replace(/<w:p[^>]*>/g, '\n')
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<w:br\/>/g, '\n')
        .replace(/<w:t[^>]*>(.*?)<\/w:t>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (text.length >= 10) {
        return text;
      }
    }
  } catch (err) {
    console.warn('FillX: JSZip DOCX fallback error:', err);
  }

  return '';
}
