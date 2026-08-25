import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import FileInfoCard from '../components/FileInfoCard';
import ProgressBar from '../components/ProgressBar';

export default function ProcessingScreen({ onComplete }) {
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    // TODO: replace the mock timer with the extraction API call and progress events.
    const timer = window.setInterval(() => {
      setPercentage((current) => {
        if (current >= 100) { window.clearInterval(timer); return 100; }
        return Math.min(current + 2, 100);
      });
    }, 60);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (percentage !== 100) return undefined;
    const transition = window.setTimeout(onComplete, 650);
    return () => window.clearTimeout(transition);
  }, [percentage, onComplete]);

  return <section className="processing-screen"><FileInfoCard /><div className="processing-copy"><div className="processing-icon"><Sparkles size={22} /></div><h1 className="font-display">Extracting Insights</h1><p>Applying executive precision models...</p></div><ProgressBar percentage={percentage} /><p className="processing-footnote">Your document is being analyzed securely.</p></section>;
}