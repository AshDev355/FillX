import React from 'react';
import { FileUp, ScanLine, LockKeyhole } from 'lucide-react';
import PrimaryButton from '../components/PrimaryButton';
import UploadOptionCard from '../components/UploadOptionCard';

export default function UploadPromptScreen({ onUpload, onManual }) {
  return (
    <section className="upload-screen">
      <div className="upload-hero">
        <div className="scan-badge">
          <ScanLine size={36} strokeWidth={1.8} />
        </div>
        <h1 className="font-display">Add your info once</h1>
        <p>
          Upload a recent document to automatically extract your details and streamline future requests.
        </p>
      </div>

      <PrimaryButton icon={FileUp} onClick={onUpload}>
        UPLOAD DOCUMENT
      </PrimaryButton>

      <div className="or-divider">
        <span>OR</span>
      </div>

      <UploadOptionCard onClick={onManual} />

      <p className="secure-note">
        <LockKeyhole size={13} />
        <span>Secure encrypted processing</span>
      </p>
    </section>
  );
}
