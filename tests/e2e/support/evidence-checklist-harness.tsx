import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import EvidenceRichEditor from '../../../src/components/EvidenceRichEditor';
import { normalizeEvidenceHtml } from '../../../src/utils/evidenceRichText';
import '../../../src/index.css';

function Harness() {
  const [value, setValue] = useState(normalizeEvidenceHtml(localStorage.getItem('checklist-test')));
  const [disabled, setDisabled] = useState(false);
  return <>
    <button onClick={() => setDisabled(!disabled)}>Solo lectura</button>
    <EvidenceRichEditor value={value} disabled={disabled} onChange={html => {
      localStorage.setItem('checklist-test', html);
      setValue(html);
    }} />
  </>;
}

createRoot(document.getElementById('root')!).render(<Harness />);
