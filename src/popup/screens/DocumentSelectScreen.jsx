import React, { useRef, useState } from 'react';
import { ArrowUp, FileText, UploadCloud, AlertCircle, AlignLeft, Upload } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton';
import OutlineButton from '../components/OutlineButton';
import { parseUploadedFile } from '../../utils/fileReader.js';

export default function DocumentSelectScreen({ onProcess, onBack }) {
  const inputRef = useRef(null);
  const [mode, setMode] = useState('file'); // 'file' | 'paste'
  const [selectedFile, setSelectedFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUploadSubmit = async () => {
    setIsReading(true);
    setError(null);

    try {
      let documentText = '';
      let fileName = 'resume_2026.pdf';
      let fileSize = '2.4 MB · PDF Document';

      if (mode === 'file') {
        if (!selectedFile) throw new Error('Please select a file to upload.');
        documentText = await parseUploadedFile(selectedFile);
        fileName = selectedFile.name;
        fileSize = `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · ${selectedFile.name.split('.').pop()?.toUpperCase()} Document`;
      } else {
        if (!pastedText.trim()) throw new Error('Please paste your resume or bio text.');
        documentText = pastedText.trim();
        fileName = 'pasted_resume.txt';
        fileSize = `${(new Blob([documentText]).size / 1024).toFixed(1)} KB · Text Document`;
      }

      if (!documentText || documentText.trim().length < 5) {
        throw new Error('Could not extract readable text from this document.');
      }

      onProcess({
        documentText,
        fileName,
        fileSize,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error processing document.');
      setIsReading(false);
    }
  };

  return (
    <section className="select-screen">
      <div className="screen-heading">
        <span className="section-icon">
          <UploadCloud size={23} />
        </span>
        <p className="eyebrow-text">NEW DOCUMENT</p>
        <h1 className="font-display">Choose a document</h1>
        <p>Select a PDF, resume, invoice, or other file to extract details from.</p>
      </div>

      {/* Mode Switcher */}
      <div className="auth-tabs" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={`auth-tab-btn ${mode === 'file' ? 'active' : ''}`}
          onClick={() => setMode('file')}
        >
          Upload Document
        </button>
        <button
          type="button"
          className={`auth-tab-btn ${mode === 'paste' ? 'active' : ''}`}
          onClick={() => setMode('paste')}
        >
          Paste Raw Text
        </button>
      </div>

      {mode === 'file' ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="drop-zone"
            onClick={() => inputRef.current?.click()}
          >
            <span className="drop-icon">
              <ArrowUp size={20} />
            </span>
            <strong>{selectedFile ? selectedFile.name : 'Choose a file'}</strong>
            <small>{selectedFile ? 'Ready to upload' : 'PDF, DOCX, DOC or TXT up to 10 MB'}</small>
          </button>

          {selectedFile && (
            <div className="chosen-file">
              <FileText size={16} />
              <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            rows={6}
            placeholder="Paste your CV, cover letter, or profile text here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 11,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-card)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>
      )}

      {error && (
        <div className="auth-error-banner" style={{ marginTop: 12 }}>
          <AlertCircle size={14} flexShrink={0} />
          <span>{error}</span>
        </div>
      )}

      <div className="select-actions">
        <PrimaryButton
          icon={UploadCloud}
          disabled={isReading || (mode === 'file' && !selectedFile) || (mode === 'paste' && !pastedText.trim())}
          onClick={handleUploadSubmit}
        >
          {isReading ? 'READING FILE...' : 'UPLOAD FILE'}
        </PrimaryButton>
        <OutlineButton onClick={onBack}>
          CANCEL
        </OutlineButton>
      </div>
    </section>
  );
}
