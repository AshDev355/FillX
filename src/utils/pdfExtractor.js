/**
 * pdfExtractor.js — Client-Side PDF Parser with Spatial Reading-Order Sorting
 *
 * Reliably extracts plain text from any PDF ArrayBuffer:
 *   1. Primary: PDF.js with 2D spatial sorting (Y-descending, X-ascending) for reading order
 *   2. Secondary: Native WebStream DecompressionStream for FlateDecode streams
 *   3. Tertiary: Content stream text operator parser (BT ... ET, Tj, TJ)
 *   4. Quaternary: Printable character scanner
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure PDF.js worker fallback
try {
  if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
} catch {}

/**
 * Groups and sorts PDF text items by vertical lines (Y descending) and horizontal position (X ascending).
 * Preserves paragraphs and reading order accurately.
 *
 * @param {Array<object>} items
 * @returns {string}
 */
function organizePageTextItems(items) {
  if (!Array.isArray(items) || items.length === 0) return '';

  const validItems = items
    .filter((item) => item && (item.str || item.str === ' '))
    .map((item) => {
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      return {
        str: item.str,
        x: Math.round(transform[4] * 10) / 10,
        y: Math.round(transform[5] * 10) / 10,
        width: item.width || 0,
        height: item.height || 0,
      };
    });

  if (validItems.length === 0) return '';

  // Sort by Y descending (top to bottom), then by X ascending (left to right)
  // Use a 4px bucket tolerance for items on the same visual line
  const lineBuckets = [];

  for (const item of validItems) {
    let placed = false;
    for (const bucket of lineBuckets) {
      if (Math.abs(bucket.y - item.y) <= 4) {
        bucket.items.push(item);
        // Average Y for the line
        bucket.y = (bucket.y * (bucket.items.length - 1) + item.y) / bucket.items.length;
        placed = true;
        break;
      }
    }

    if (!placed) {
      lineBuckets.push({ y: item.y, items: [item] });
    }
  }

  // Sort lines from top to bottom (higher Y in PDF coordinate space is higher up the page)
  lineBuckets.sort((a, b) => b.y - a.y);

  const formattedLines = [];
  let prevLineY = null;

  for (const bucket of lineBuckets) {
    // Sort items within this line from left to right
    bucket.items.sort((a, b) => a.x - b.x);

    // Detect paragraph breaks based on vertical spacing (> 18px jump)
    if (prevLineY !== null && Math.abs(prevLineY - bucket.y) > 18) {
      formattedLines.push('');
    }
    prevLineY = bucket.y;

    const lineText = bucket.items
      .map((it) => it.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (lineText) {
      formattedLines.push(lineText);
    }
  }

  return formattedLines.join('\n');
}

/**
 * Extracts plain text from a PDF ArrayBuffer using PDF.js.
 */
async function extractWithPdfJs(arrayBuffer) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
      stopAtErrors: false,
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const pageTexts = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const organizedText = organizePageTextItems(textContent.items);

        if (organizedText) {
          pageTexts.push(organizedText);
        }
      } catch (pageErr) {
        console.warn(`FillX: Failed to parse PDF page ${pageNum}:`, pageErr);
      }
    }

    const fullText = pageTexts.join('\n\n').trim();
    if (fullText.length >= 10) {
      return fullText;
    }
  } catch (err) {
    console.warn('FillX: PDF.js primary extractor notice, switching to stream scanner:', err);
  }
  return '';
}

/**
 * Decompresses a single Deflate / Zlib stream chunk using native DecompressionStream.
 */
async function decompressDeflateStream(chunkBytes) {
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(chunkBytes);
    writer.close();

    const response = new Response(ds.readable);
    return await response.text();
  } catch (e1) {
    try {
      const rawBytes = chunkBytes.slice(2);
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(rawBytes);
      writer.close();

      const response = new Response(ds.readable);
      return await response.text();
    } catch (e2) {
      return '';
    }
  }
}

/**
 * Extracts plain text strings from PDF content stream syntax (Tj, TJ, ', ").
 */
function parsePdfStreamText(streamText) {
  if (!streamText) return '';
  const textPieces = [];

  const tjRegex = /\(((?:\\\(|\\\)|[^()])*)\)\s*(?:Tj|'|")/g;
  let match;
  while ((match = tjRegex.exec(streamText)) !== null) {
    const raw = match[1]
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ');
    if (raw.trim()) textPieces.push(raw);
  }

  const arrayTjRegex = /\[((?:[^[\]]|\([^[\]]*\))*)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(streamText)) !== null) {
    const inner = match[1];
    const itemRegex = /\(((?:\\\(|\\\)|[^()])*)\)/g;
    let itemMatch;
    const arrayPieces = [];
    while ((itemMatch = itemRegex.exec(inner)) !== null) {
      const raw = itemMatch[1].replace(/\\([()\\])/g, '$1');
      if (raw.trim()) arrayPieces.push(raw);
    }
    if (arrayPieces.length > 0) {
      textPieces.push(arrayPieces.join(''));
    }
  }

  return textPieces.join(' ');
}

/**
 * Decompresses all FlateDecode streams in a raw PDF buffer and extracts text.
 */
async function extractFromPdfStreams(arrayBuffer) {
  try {
    const uint8 = new Uint8Array(arrayBuffer);
    const latinDecoder = new TextDecoder('latin1');
    const rawContent = latinDecoder.decode(uint8);

    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    const extractedChunks = [];
    let match;

    while ((match = streamRegex.exec(rawContent)) !== null) {
      const streamStart = match.index + match[0].indexOf('stream') + 6;
      let actualStart = streamStart;
      if (uint8[actualStart] === 0x0d && uint8[actualStart + 1] === 0x0a) actualStart += 2;
      else if (uint8[actualStart] === 0x0a || uint8[actualStart] === 0x0d) actualStart += 1;

      const endstreamPos = rawContent.indexOf('endstream', actualStart);
      if (endstreamPos === -1) continue;

      const chunkBytes = uint8.slice(actualStart, endstreamPos);
      if (chunkBytes.length < 4) continue;

      if (chunkBytes[0] === 0x78) {
        const decompressed = await decompressDeflateStream(chunkBytes);
        if (decompressed) {
          const parsed = parsePdfStreamText(decompressed);
          if (parsed) extractedChunks.push(parsed);
        }
      } else {
        const text = parsePdfStreamText(latinDecoder.decode(chunkBytes));
        if (text) extractedChunks.push(text);
      }
    }

    const result = extractedChunks.join('\n').trim();
    if (result.length >= 10) {
      return result;
    }
  } catch (err) {
    console.warn('FillX: Stream decompressor error:', err);
  }
  return '';
}

/**
 * Main PDF text extractor.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 */
export async function extractTextFromPDF(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return '';
  }

  // 1. Primary: PDF.js with 2D spatial sorting
  const primaryText = await extractWithPdfJs(arrayBuffer);
  if (primaryText && primaryText.length >= 10) {
    return primaryText;
  }

  // 2. Secondary: Direct FlateDecode stream decompression
  const streamText = await extractFromPdfStreams(arrayBuffer);
  if (streamText && streamText.length >= 10) {
    return streamText;
  }

  // 3. Tertiary: Printable ASCII scanner
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const content = decoder.decode(bytes);
    const words = content.match(/[A-Za-z0-9@._+&$,:;/-]{3,}/g) || [];
    return words.join(' ');
  } catch (e) {
    return '';
  }
}
