/** Parse Prisma/JSON evidence link list from API */
export function parseEvidenceLinks(evidenceLinks: unknown): string[] {
  if (!evidenceLinks) return [];
  if (Array.isArray(evidenceLinks)) {
    return evidenceLinks.filter((x): x is string => typeof x === 'string');
  }
  return [];
}

export type EvidenceAssetKind = 'image' | 'pdf' | 'word' | 'raw' | 'other';

export function evidenceAssetKind(url: string): EvidenceAssetKind {
  const u = url.split('?')[0].toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(u) || u.includes('/image/upload/')) {
    return 'image';
  }
  if (u.endsWith('.pdf') || /\/[^/]+\.pdf$/i.test(u)) return 'pdf';
  if (/\.(doc|docx)$/i.test(u)) return 'word';
  if (u.includes('/raw/upload/')) return 'raw';
  return 'other';
}

export function isImageEvidenceUrl(url: string): boolean {
  return evidenceAssetKind(url) === 'image';
}
