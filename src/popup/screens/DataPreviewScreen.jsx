import React from 'react';
import { Save, Pencil } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton';
import OutlineButton from '../components/OutlineButton';
import SuccessBanner from '../components/SuccessBanner';
import ExtractedFieldCard from '../components/ExtractedFieldCard';

const fields = [['Vendor Name', 'Acme Corporation'], ['Invoice Date', 'October 24, 2023'], ['Total Amount', '$4,520.00', true], ['Line Items Detected', '8 items'], ['Payment Terms', 'Net 30'], ['Due Date', 'November 23, 2023']];

export default function DataPreviewScreen({ onEdit, onSave }) {
  return <section className="preview-screen"><div className="preview-scroll"><SuccessBanner /><p className="eyebrow-text preview-label">EXTRACTED DATA</p><div className="fields-list">{fields.map(([label, value, emphasis]) => <ExtractedFieldCard key={label} label={label} value={value} emphasis={emphasis} />)}</div></div><div className="preview-actions"><PrimaryButton icon={Save} onClick={() => { /* TODO: wire save-profile action */ onSave(); }}>SAVE &amp; CONTINUE</PrimaryButton><OutlineButton icon={Pencil} onClick={onEdit}>EDIT MANUALLY</OutlineButton></div></section>;
}