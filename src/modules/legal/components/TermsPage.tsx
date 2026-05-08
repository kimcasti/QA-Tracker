import LegalLayout from './LegalLayout';
import { legalDocumentsByPath } from '../content';

export default function TermsPage() {
  return <LegalLayout document={legalDocumentsByPath['/terminos']} />;
}
