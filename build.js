/**
 * build.js — Zero-dependency Bundler & Packaging Script for FillX Content Script
 *
 * Combines modular content script files into a clean, standalone, browser-executable
 * bundle (dist/contentScript.bundle.js) suitable for Manifest V3 content_scripts.
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Order of modules to bundle for content script
const modules = [
  'shared/messageTypes.js',
  'content/fieldIdentifier.js',
  'content/fieldDetector.js',
  'content/valueSetter.js',
  'content/highlighter.js',
  'content/fieldState.js',
  'content/savePromptBridge.js',
  'content/openEndedGenerator.js',
  'content/dynamicObserver.js',
  'content/autofillEngine.js',
  'content/contentScript.js',
];

let bundleContent = `/**
 * FillX Extension — Content Script Standalone Bundle
 * Complete, production-ready bundle combining all Member 1 content modules.
 */
(() => {
  'use strict';
`;

for (const relPath of modules) {
  const filePath = path.join(srcDir, relPath);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Missing source file ${filePath}`);
    process.exit(1);
  }

  let code = fs.readFileSync(filePath, 'utf8');

  // Strip ES import and export statements to combine into single IIFE scope
  code = code
    .replace(/^\s*import\s+[^;]+;\s*$/gm, '')
    .replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ')
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');

  bundleContent += `\n  // ─── Module: ${relPath} ───\n`;
  bundleContent += code + '\n';
}

bundleContent += `
})();
`;

// Write to dist/contentScript.bundle.js and src/content/contentScript.bundle.js
fs.writeFileSync(path.join(distDir, 'contentScript.bundle.js'), bundleContent, 'utf8');
fs.writeFileSync(path.join(srcDir, 'content', 'contentScript.bundle.js'), bundleContent, 'utf8');

// Copy CSS to dist/
const cssPath = path.join(srcDir, 'content', 'highlighter.css');
if (fs.existsSync(cssPath)) {
  fs.copyFileSync(cssPath, path.join(distDir, 'highlighter.css'));
}

console.log('✓ FillX Content Script bundled successfully to dist/contentScript.bundle.js');
