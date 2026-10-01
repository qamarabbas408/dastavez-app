/**
 * Sample data for the parts of the prototype that are still simulated.
 *
 * Real documents do not appear here. They live in SQLite, and their page images
 * live in app storage.
 */

import { newId } from '@/data/ids';

import type { DraftPage, MockSourceItem } from './types';

const CAPTURE_LABELS = ['Page A', 'Page B', 'Page C', 'Page D', 'Page E', 'Page F'];

/**
 * A stand-in page for the shutter, Add page, and Retake.
 *
 * The scan path has no real camera yet, so a "capture" is drawn rather than
 * photographed. Pages from here have no `uri`, which is why Save refuses a
 * draft that contains only these — a record with no image would be worse than
 * no record.
 */
export function takeCapturePage(index: number): DraftPage {
  return {
    id: newId('page'),
    order: index,
    label: CAPTURE_LABELS[index % CAPTURE_LABELS.length],
    rotation: 0,
    filter: 'original',
  };
}

/**
 * Sample PDFs for the still-simulated PDF import path.
 *
 * A real PDF cannot become page images without a rasteriser, and none has been
 * chosen, so these stay invented. Photos no longer appear here: they are read
 * from the system library through the data layer.
 */
export const MOCK_PDF_SOURCES: MockSourceItem[] = [
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
];
