/**
 * PayWatch AI Pipeline — Public API
 *
 * ALL AI calls go through this barrel export.
 * Routes import from '@/lib/ai' only, never from individual AI client files.
 *
 * SERVER-ONLY — never import in client components.
 */

export {
  classifyEmail,
  extractBillFromEmail,
  extractBillFromPhoto,
  generateInsight,
  generateDraftLetter,
} from './pipeline';

export type {
  ClassificationResult,
  BillExtractionResult,
  CameraExtractionResult,
  InsightResult,
  DraftLetterResult,
} from './pipeline';
