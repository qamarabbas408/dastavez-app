/**
 * Seed data for the prototype.
 *
 * All titles, dates, and recognised text below are invented. No real agency
 * names, addresses, or records appear anywhere in this file.
 */

import type { MockDocument, MockPage, MockSourceItem, SourceKind } from './types';

let pageCounter = 0;

/**
 * Deterministic page ids. Reset alongside the store so a fresh draft always
 * produces the same ids, which keeps screenshots stable between runs.
 */
export function nextPageId(): string {
  pageCounter += 1;
  return `page-${pageCounter}`;
}

export function resetPageIds(): void {
  pageCounter = 0;
}

function pages(labels: string[]): MockPage[] {
  return labels.map((label, order) => ({
    id: nextPageId(),
    order,
    label,
    rotation: 0,
    filter: 'original' as const,
  }));
}

/**
 * Pool used by the shutter, Add page, and Retake. Reused deliberately so the
 * same six pages can appear in any order without the UI needing real capture.
 */
export const MOCK_CAPTURE_PAGES: MockPage[] = pages([
  'Page A',
  'Page B',
  'Page C',
  'Page D',
  'Page E',
  'Page F',
]);

/** Picks the next unused capture page, wrapping once the pool is exhausted. */
export function takeCapturePage(index: number): MockPage {
  const template = MOCK_CAPTURE_PAGES[index % MOCK_CAPTURE_PAGES.length];
  return { ...template, id: nextPageId(), order: index };
}

function seededDocument(
  id: string,
  title: string,
  date: string,
  fileType: MockDocument['fileType'],
  pageLabels: string[],
  ocrText: string,
): MockDocument {
  return {
    id,
    title,
    date,
    fileType,
    pages: pages(pageLabels),
    ocrStatus: 'complete',
    ocrText,
  };
}

export function createSeedDocuments(): MockDocument[] {
  return [
    seededDocument(
      'doc-harbour-log',
      'Harbour Maintenance Log',
      '2026-08-14',
      'pdf',
      ['Page 1', 'Page 2', 'Page 3'],
      'HARBOUR MAINTENANCE LOG — Quay 3\n\n08:40 Jetty bollard B7 inspected.\n09:15 Handrail on the north ladder rusted; flagged for replacement.\n11:02 Lighting column L12 replaced.\n\nSample text for prototype display only.',
    ),
    seededDocument(
      'doc-tenant-notice',
      'Tenant Notice — Unit 4B',
      '2026-07-02',
      'jpeg',
      ['Page 1', 'Page 2'],
      'TENANT NOTICE — UNIT 4B\n\nThe water shut-off for Unit 4B is scheduled for 9 June, 09:00–12:00.\n\nAccess to the riser cupboard is required. Please secure pets beforehand.\n\nSample text for prototype display only.',
    ),
    seededDocument(
      'doc-vehicle-handover',
      'Vehicle Handover Checklist',
      '2026-06-21',
      'jpeg',
      ['Page 1'],
      'VEHICLE HANDOVER CHECKLIST\n\nOdometer: 48 210 km\nFuel: 3/4 tank\nSpare tyre: present\nTool kit: present\n\nBoth parties confirm the above.\n\nSample text for prototype display only.',
    ),
    seededDocument(
      'doc-committee-minutes',
      'Committee Minutes',
      '2026-05-30',
      'pdf',
      ['Page 1', 'Page 2', 'Page 3', 'Page 4', 'Page 5'],
      'COMMITTEE MINUTES — May session\n\n1. Previous minutes approved without amendment.\n2. Grounds maintenance contract renewed for 12 months.\n3. Bin store access agreed for 06:30 daily.\n\nSample text for prototype display only.',
    ),
  ];
}

/**
 * Photos and PDFs offer disjoint items so the choice of source is visibly
 * meaningful rather than cosmetic.
 */
export const MOCK_SOURCES: Record<SourceKind, MockSourceItem[]> = {
  photos: [
    { id: 'photo-1', title: 'IMG_0412', subtitle: '2 August 2026 · 14:22', pageCount: 1, kind: 'jpeg' },
    { id: 'photo-2', title: 'IMG_0418', subtitle: '2 August 2026 · 14:31', pageCount: 1, kind: 'jpeg' },
    { id: 'photo-3', title: 'IMG_0431', subtitle: '3 August 2026 · 09:07', pageCount: 1, kind: 'jpeg' },
  ],
  pdfs: [
    {
      id: 'pdf-1',
      title: 'Service Agreement (draft).pdf',
      subtitle: '18 pages · 1.2 MB',
      pageCount: 6,
      kind: 'pdf',
    },
    {
      id: 'pdf-2',
      title: 'Floor Plan — Ground.pdf',
      subtitle: '1 page · 640 KB',
      pageCount: 1,
      kind: 'pdf',
    },
    {
      id: 'pdf-3',
      title: 'Inspection Report.pdf',
      subtitle: '9 pages · 3.4 MB',
      pageCount: 4,
      kind: 'pdf',
    },
  ],
};