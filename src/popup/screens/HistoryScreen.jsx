import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, History as HistoryIcon } from 'lucide-react';
import { getHistory } from '../../utils/storage.js';

export default function HistoryScreen() {
  const [historyItems, setHistoryItems] = useState([]);

  useEffect(() => {
    getHistory().then((items) => {
      if (Array.isArray(items) && items.length > 0) {
        setHistoryItems(items);
      } else {
        setHistoryItems([
          { type: 'DOCUMENT', title: 'resume_2026.pdf', meta: 'Extracted just now', status: 'READY' },
          { type: 'FORM', title: 'Personal profile', meta: 'Completed October 18, 2023', status: 'SAVED' },
          { type: 'DOCUMENT', title: 'invoice_october.pdf', meta: 'Processed October 12, 2023', status: 'READY' },
        ]);
      }
    });
  }, []);

  return (
    <section className="history-screen">
      <div className="screen-heading compact">
        <p className="eyebrow-text">YOUR ACTIVITY</p>
        <h1 className="font-display">History</h1>
        <p>Recently processed documents and autofilled forms.</p>
      </div>

      <div className="history-list">
        {historyItems.map((item, idx) => (
          <div key={idx} className="history-item">
            <span className="history-icon">
              {item.type === 'FORM' ? <CheckCircle2 size={17} /> : <FileText size={17} />}
            </span>
            <div className="history-copy">
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </div>
            <span className="history-status">{item.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
