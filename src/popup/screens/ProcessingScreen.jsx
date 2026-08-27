import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import FileInfoCard from '../components/FileInfoCard';
import ProgressBar from '../components/ProgressBar';
import OutlineButton from '../components/OutlineButton';
import { MESSAGE_TYPES } from '../../shared/messageTypes.js';
import { extractProfileFromDocument } from '../../utils/documentParser.js';
import { mergeProfile, getSettings } from '../../utils/storage.js';

export default function ProcessingScreen({ documentPayload, onComplete, onError }) {
  const [percentage, setPercentage] = useState(25);
  const [error, setError] = useState(null);

  useEffect(() => {
    let timer;
    let isCancelled = false;

    timer = setInterval(() => {
      setPercentage((prev) => {
        if (prev < 45) return prev + 12;
        if (prev < 75) return prev + 6;
        if (prev < 92) return prev + 2;
        return prev;
      });
    }, 120);

    async function processDocument() {
      const documentText = documentPayload?.documentText || '';
      const fileName = documentPayload?.fileName || 'resume_2026.pdf';

      try {
        let extracted = null;

        // 1. Try background service worker relay first
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          try {
            const bgResponse = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                {
                  type: MESSAGE_TYPES.EXTRACT_DOCUMENT,
                  payload: { documentText, fileName },
                },
                (res) => {
                  if (chrome.runtime?.lastError) {
                    resolve(null);
                  } else {
                    resolve(res);
                  }
                }
              );
              // Timeout after 6 seconds to prevent hanging
              setTimeout(() => resolve(null), 6000);
            });

            if (bgResponse?.success && bgResponse.profile) {
              extracted = bgResponse.profile;
            }
          } catch (e) {
            console.warn('FillX: Background extraction relay notice, using client fallback:', e);
          }
        }

        // 2. If background relay didn't return, extract directly in popup
        if (!extracted) {
          const settings = await getSettings();
          extracted = await extractProfileFromDocument(documentText, settings?.backendUrl);
          await mergeProfile(extracted, fileName);
        }

        if (isCancelled) return;

        clearInterval(timer);
        setPercentage(100);

        setTimeout(() => {
          if (!isCancelled && onComplete) {
            onComplete(extracted, fileName);
          }
        }, 350);
      } catch (err) {
        console.error('FillX: Document extraction error:', err);
        if (!isCancelled) {
          clearInterval(timer);
          setError(err.message || 'Failed to extract document insights.');
        }
      }
    }

    processDocument();

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [documentPayload, onComplete]);

  return (
    <section className="processing-screen">
      <FileInfoCard
        fileName={documentPayload?.fileName || 'resume_2026.pdf'}
        fileSize={documentPayload?.fileSize || '2.4 MB · PDF Document'}
      />

      <div className="processing-copy">
        <h1 className="font-display">Extracting Insights</h1>
        <p>Analyzing document structure and parsing fields...</p>
      </div>

      <ProgressBar percentage={percentage} />

      {error && (
        <div className="auth-error-banner" style={{ marginTop: 12 }}>
          <AlertCircle size={14} flexShrink={0} />
          <span>{error}</span>
        </div>
      )}

      {error && (
        <OutlineButton onClick={onError} style={{ marginTop: 12 }}>
          TRY ANOTHER FILE
        </OutlineButton>
      )}
    </section>
  );
}
