import React, { useState } from 'react';
import { Check, UserRound } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton';
import OutlineButton from '../components/OutlineButton';

export default function ManualFormScreen({ onSave, onBack, editingExtracted = false }) {
  const initialData = editingExtracted
    ? { vendor: 'Acme Corporation', invoiceDate: 'October 24, 2023', amount: '$4,520.00', terms: 'Net 30', dueDate: 'November 23, 2023' }
    : { fullName: '', email: '', phone: '', company: '', role: '' };
  const [profile, setProfile] = useState(initialData);
  const update = (event) => setProfile({ ...profile, [event.target.name]: event.target.value });
  const fields = editingExtracted
    ? [['VENDOR NAME', 'vendor', 'Acme Corporation'], ['INVOICE DATE', 'invoiceDate', 'October 24, 2023'], ['TOTAL AMOUNT', 'amount', '$4,520.00'], ['PAYMENT TERMS', 'terms', 'Net 30'], ['DUE DATE', 'dueDate', 'November 23, 2023']]
    : [['FULL NAME', 'fullName', 'e.g. Alex Morgan'], ['EMAIL ADDRESS', 'email', 'alex@example.com'], ['PHONE NUMBER', 'phone', '+1 555 000 0000'], ['COMPANY', 'company', 'Company name'], ['JOB TITLE', 'role', 'Your role']];
  return <section className="manual-screen"><div className="screen-heading compact"><span className="section-icon"><UserRound size={22} /></span><p className="eyebrow-text">{editingExtracted ? 'EDIT EXTRACTED DATA' : 'YOUR PROFILE'}</p><h1 className="font-display">{editingExtracted ? 'Review your details' : 'Tell us about you'}</h1><p>{editingExtracted ? 'Make any corrections before saving this document.' : 'Answer a few questions once, then FillX can reuse them in future forms.'}</p></div><form className="manual-form" onSubmit={(event) => { event.preventDefault(); onSave(profile); }}>{fields.map(([label, name, placeholder]) => <label key={name}>{label}<input required={name === 'fullName' || name === 'email' || name === 'vendor'} type={name === 'email' ? 'email' : 'text'} name={name} value={profile[name]} onChange={update} placeholder={placeholder} /></label>)}<div className="form-actions"><PrimaryButton type="submit" icon={Check}>{editingExtracted ? 'SAVE CHANGES' : 'SAVE PROFILE'}</PrimaryButton><OutlineButton type="button" onClick={onBack}>CANCEL</OutlineButton></div></form></section>;
}