/**
 * PRD validation utilities
 */

import { readFileSync } from 'fs';
import { validateAnswers, type PrdAnswers } from './prd-types.js';

/**
 * Validate PRD markdown file
 */
export function validatePrdFile(filePath: string): { valid: boolean; errors: string[] } {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // Basic checks
    if (!content.trim()) {
      return { valid: false, errors: ['PRD file is empty'] };
    }

    // Check for PRD structure (should have # PRD: title)
    if (!content.match(/^#\s+PRD:/m)) {
      return { valid: false, errors: ['PRD file must start with "# PRD: <product name>"'] };
    }

    // Try to parse as PrdAnswers if possible (optional - for stricter validation)
    // For now, just check basic structure

    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof Error) {
      return { valid: false, errors: [`Failed to read file: ${error.message}`] };
    }
    return { valid: false, errors: ['Unknown error reading file'] };
  }
}

/**
 * Extract product name from PRD markdown
 */
export function extractProductName(content: string): string | null {
  // Remove filename comment if present
  const withoutComment = content.replace(/<!--[\s\S]*?-->\n\n?/g, '');
  
  // Try "PRD: Product Name" format
  const match = withoutComment.match(/^#\s+PRD:\s*(.+)$/m) || withoutComment.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Generate filename from product name
 */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .substring(0, 100)
    || 'data-product-prd';
}

