import React, { useRef, useState } from 'react';
import { ArrowUp, FileText, UploadCloud } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton';
import OutlineButton from '../components/OutlineButton';

export default function DocumentSelectScreen({ onUpload, onBack }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const chooseFile = (event) => setFileName(event.target.files[0]?.name || '');
  return <section className="select-screen"><div className="screen-heading"><span className="section-icon"><UploadCloud size={23} /></span><p className="eyebrow-text">NEW DOCUMENT</p><h1 className="font-display">Choose a document</h1><p>Select a PDF, resume, invoice, or other file to extract details from.</p></div><input ref={inputRef} className="visually-hidden" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={chooseFile} /><button className="drop-zone" onClick={() => inputRef.current?.click()}><span className="drop-icon"><ArrowUp size={22} /></span><strong>{fileName || 'Choose a file'}</strong><small>{fileName ? 'Ready to upload' : 'PDF, DOCX, PNG or JPG up to 10 MB'}</small></button>{fileName && <div className="chosen-file"><FileText size={18} /><span>{fileName}</span></div>}<div className="select-actions"><PrimaryButton icon={UploadCloud} disabled={!fileName} onClick={onUpload}>UPLOAD FILE</PrimaryButton><OutlineButton onClick={onBack}>CANCEL</OutlineButton></div></section>;
}