import LegalLayout from './LegalLayout';
import { legalDocumentsByPath } from '../content';

export default function AIPolicyPage() {
  return <LegalLayout document={legalDocumentsByPath['/uso-ia']} />;
}
