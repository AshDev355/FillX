import React from 'react';
import { ChevronRight, FileText, UserRound } from 'lucide-react';

export default function HistoryScreen({ history }) {
  return <section className="history-screen"><div className="screen-heading compact"><p className="eyebrow-text">YOUR ACTIVITY</p><h1 className="font-display">History</h1><p>Previously uploaded documents and saved profiles.</p></div><div className="history-list">{history.map((item, index) => <button className="history-item" key={`${item.title}-${index}`}><span className="history-icon">{item.type === 'FORM' ? <UserRound size={19} /> : <FileText size={19} />}</span><span className="history-copy"><strong>{item.title}</strong><small>{item.meta}</small></span><span className="history-status">{item.status}</span><ChevronRight size={16} /></button>)}</div></section>;
}