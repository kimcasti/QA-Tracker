import LegalLayout from './LegalLayout';
import { legalDocumentsByPath } from '../content';

export default function PrivacyPage() {
  return <LegalLayout document={legalDocumentsByPath['/privacidad']} />;
}
