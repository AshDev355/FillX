import React from 'react';
import { Check } from 'lucide-react';

export default function SuccessBanner() {
  return <div className="success-banner"><span className="success-icon"><Check size={20} strokeWidth={2.8} /></span><span><strong>Extraction Complete</strong><small>Invoice #INV-2023-084</small></span></div>;
}