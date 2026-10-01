/**
 * Session store.
 *
 * Holds the working draft and UI state only: which screens have been seen,
 * whether the app is locked, the developer failure toggles, and the transient
 * status line. Persisted documents live in SQLite behind `src/data`; screens
 * read them through the repository and `useAsyncData`.
 *
 * Nothing here survives a restart, which now only means an unfinished draft.
 */

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { newId } from '@/data/ids';
import type { DocumentRecord } from '@/data/types';

import { MOCK_PDF_SOURCES, takeCapturePage } from './seed';
import type {
  Draft,
  DraftPage,
  FailureFlags,
  MockSourceItem,
  OcrStatus,
  PageCorners,
  PageFilter,
  StatusMessage,
} from './types';

export type UnlockState = 'locked' | 'unlocked';

type StoreState = {
  /** False until Welcome is dismissed. Drives the first-launch redirect. */
  hasSeenWelcome: boolean;
  unlockState: UnlockState;
  draft: Draft | null;
  failures: FailureFlags;
  status: StatusMessage;
};

const noFailures: FailureFlags = {
  emptyLibrary: false,
  permissionDenied: false,
  unlockCancelled: false,
  ocrFailure: false,
  lowStorage: false,
  exportCancelled: false,
};

function createInitialState(): StoreState {
  return {
    hasSeenWelcome: false,
    unlockState: 'locked',
    draft: null,
    failures: { ...noFailures },
    status: null,
  };
}

export type StoreAction =
  | { type: 'welcome/complete' }
  | { type: 'unlock/success' }
  | { type: 'unlock/cancel'; message: string }
  | { type: 'draft/startScan'; pageCount: number }
  | { type: 'draft/startImport'; item: MockSourceItem }
  | { type: 'draft/startImportMany'; items: MockSourceItem[] }
  | { type: 'draft/startImportImages'; pages: { id: string; uri: string }[]; title?: string }
  | { type: 'draft/startEdit'; document: DocumentRecord }
  | { type: 'draft/addPage' }
  | { type: 'draft/retakePage'; pageId: string }
  | { type: 'draft/removePage'; pageId: string }
  | { type: 'draft/rotatePage'; pageId: string }
  | { type: 'draft/reorderPages'; from: number; to: number }
  | { type: 'draft/setFilter'; pageId: string; filter: PageFilter }
  | { type: 'draft/setCorners'; pageId: string; corners: PageCorners | null }
  | { type: 'draft/setTitle'; title: string }
  | { type: 'draft/setExportFormat'; exportAsPdf: boolean }
  | { type: 'draft/setOcrEnabled'; enabled: boolean }
  | { type: 'draft/retryOcr' }
  | { type: 'draft/continueWithoutOcr' }
  | { type: 'draft/clear' }
  | { type: 'draft/discard' }
  | { type: 'failure/toggle'; key: keyof FailureFlags }
  | { type: 'failure/reset' }
  | { type: 'status/set'; status: StatusMessage }
  | { type: 'status/clear' };

function reindex(pages: DraftPage[]): DraftPage[] {
  return pages.map((page, order) => ({ ...page, order }));
}

function labelFor(count: number): string {
  return `Page ${count + 1}`;
}

function applyOcrStatus(draft: Draft, status: OcrStatus, text: string): Draft {
  return { ...draft, ocrStatus: status, ocrText: text };
}

/**
 * Reducing here is deliberate rather than a hook or an effect: the OCR toggle's
 * effect on status has to be visible to the reducer, not scattered across
 * screens, so the mental model stays "one place decides state".
 */
function withOcr(draft: Draft, enabled: boolean, ocrFailure: boolean): Draft {
  if (!enabled) {
    return applyOcrStatus(draft, 'unavailable', '');
  }
  if (ocrFailure) {
    return applyOcrStatus(draft, 'failed', '');
  }
  return applyOcrStatus(draft, 'complete', SAMPLE_OCR_TEXT);
}

const SAMPLE_OCR_TEXT = `RECOGNISED SAMPLE TEXT

Line one of the mock recognition result.
Line two, present so the panel has something to scroll.
Line three confirms the text block renders at body size without clipping.

Sample text for prototype display only.`;

function reducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'welcome/complete':
      return { ...state, hasSeenWelcome: true };

    case 'unlock/success':
      return { ...state, unlockState: 'unlocked', status: null };

    case 'unlock/cancel':
      return { ...state, status: { tone: 'warning', text: action.message } };

    case 'draft/startScan': {
      const pages = Array.from({ length: Math.max(action.pageCount, 1) }, (_, index) =>
        takeCapturePage(index),
      );
      const draft: Draft = {
        origin: 'scan',
        pages: reindex(pages),
        title: '',
        exportAsPdf: pages.length > 1,
        ocrEnabled: true,
        ocrStatus: 'complete',
        ocrText: SAMPLE_OCR_TEXT,
      };
      return { ...state, draft, status: null };
    }

    case 'draft/startImport': {
      const pages: DraftPage[] = Array.from({ length: action.item.pageCount }, (_, index) => ({
        id: newId('page'),
        order: index,
        label: labelFor(index),
        rotation: 0,
        filter: 'original',
      }));
      const draft: Draft = {
        origin: 'import',
        pages,
        title: action.item.title.replace(/\.pdf$/i, ''),
        exportAsPdf: action.item.kind === 'pdf',
        ocrEnabled: true,
        ocrStatus: 'complete',
        ocrText: SAMPLE_OCR_TEXT,
      };
      return { ...state, draft, status: null };
    }

    /**
     * Several PDF items chosen in one picker pass. Handled here rather than by
     * repeated `draft/addPage` dispatches because that action draws from the
     * capture pool, which would give imported pages the wrong labels.
     */
    case 'draft/startImportMany': {
      const items = action.items;
      if (items.length === 0) return state;

      const pages: DraftPage[] = items.flatMap((item) =>
        Array.from({ length: item.pageCount }, (_, index) => ({
          id: newId('page'),
          order: 0,
          label: labelFor(index),
          rotation: 0,
          filter: 'original' as const,
        })),
      );

      const title =
        items.length === 1
          ? items[0].title.replace(/\.pdf$/i, '')
          : `${items.length} imported items`;

      const draft: Draft = {
        origin: 'import',
        pages: reindex(pages),
        title,
        exportAsPdf: items.some((item) => item.kind === 'pdf'),
        ocrEnabled: true,
        ocrStatus: 'complete',
        ocrText: SAMPLE_OCR_TEXT,
      };
      return { ...state, draft, status: null };
    }

    /**
     * Photos chosen from the system library.
     *
     * Ids are assigned at pick time so the eventual file names and record ids
     * match. The files themselves are copied into app storage on save, not here:
     * copying on pick would orphan a file whenever a draft is abandoned.
     */
    case 'draft/startImportImages': {
      if (action.pages.length === 0) return state;

      const pages: DraftPage[] = action.pages.map((page, index) => ({
        id: page.id,
        order: index,
        label: labelFor(index),
        uri: page.uri,
        rotation: 0,
        filter: 'original',
      }));

      const draft: Draft = {
        origin: 'import',
        pages,
        title: action.title?.trim() ?? '',
        exportAsPdf: pages.length > 1,
        ocrEnabled: true,
        ocrStatus: 'complete',
        ocrText: SAMPLE_OCR_TEXT,
      };
      return { ...state, draft, status: null };
    }

    /**
     * A saved document loaded back for reworking.
     *
     * Rotation, crop and filter were baked into the files when the document
     * was saved, so the pages come back neutral — there is no edit state to
     * restore, only the finished images. The page ids are carried over so a
     * save updates the existing rows instead of leaving a second record for
     * the same document.
     */
    case 'draft/startEdit': {
      const { document } = action;

      const pages: DraftPage[] = document.pages.map((page, index) => ({
        id: page.id,
        order: index,
        label: labelFor(index),
        uri: page.uri,
        rotation: 0,
        filter: 'original',
      }));

      const draft: Draft = {
        origin: 'edit',
        documentId: document.id,
        pages,
        title: document.title,
        exportAsPdf: document.fileType === 'pdf',
        ocrEnabled: document.ocrStatus !== 'unavailable',
        ocrStatus: document.ocrStatus,
        ocrText: document.ocrText,
      };
      return { ...state, draft, status: null };
    }

    case 'draft/addPage': {
      if (!state.draft) return state;
      const pages = [...state.draft.pages, takeCapturePage(state.draft.pages.length)];
      return { ...state, draft: { ...state.draft, pages: reindex(pages) } };
    }

    case 'draft/retakePage': {
      if (!state.draft) return state;
      const target = state.draft.pages.find((page) => page.id === action.pageId);
      if (!target) return state;
      const pages = state.draft.pages.map((page) =>
        page.id === action.pageId
          ? { ...takeCapturePage(page.order), id: page.id, label: page.label }
          : page,
      );
      return { ...state, draft: { ...state.draft, pages: reindex(pages) } };
    }

    case 'draft/removePage': {
      if (!state.draft) return state;
      const pages = state.draft.pages.filter((page) => page.id !== action.pageId);
      if (pages.length === state.draft.pages.length) return state;
      return { ...state, draft: { ...state.draft, pages: reindex(pages) } };
    }

    case 'draft/rotatePage': {
      if (!state.draft) return state;
      const pages = state.draft.pages.map((page) =>
        page.id === action.pageId ? { ...page, rotation: (page.rotation + 90) % 360 } : page,
      );
      return { ...state, draft: { ...state.draft, pages } };
    }

    case 'draft/reorderPages': {
      if (!state.draft) return state;
      const { from, to } = action;
      const pages = [...state.draft.pages];
      if (from < 0 || from >= pages.length || to < 0 || to >= pages.length) return state;
      const [moved] = pages.splice(from, 1);
      pages.splice(to, 0, moved);
      return { ...state, draft: { ...state.draft, pages: reindex(pages) } };
    }

    case 'draft/setFilter': {
      if (!state.draft) return state;
      const pages = state.draft.pages.map((page) =>
        page.id === action.pageId ? { ...page, filter: action.filter } : page,
      );
      return { ...state, draft: { ...state.draft, pages } };
    }

    case 'draft/setCorners': {
      if (!state.draft) return state;
      const pages = state.draft.pages.map((page) =>
        page.id === action.pageId
          ? { ...page, corners: action.corners ?? undefined }
          : page,
      );
      return { ...state, draft: { ...state.draft, pages } };
    }

    case 'draft/setTitle': {
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, title: action.title } };
    }

    case 'draft/setExportFormat': {
      if (!state.draft) return state;
      return { ...state, draft: { ...state.draft, exportAsPdf: action.exportAsPdf } };
    }

    case 'draft/setOcrEnabled': {
      if (!state.draft) return state;
      return {
        ...state,
        draft: withOcr(state.draft, action.enabled, state.failures.ocrFailure),
      };
    }

    case 'draft/retryOcr': {
      if (!state.draft) return state;
      return {
        ...state,
        draft: applyOcrStatus(state.draft, 'complete', SAMPLE_OCR_TEXT),
        failures: { ...state.failures, ocrFailure: false },
      };
    }

    case 'draft/continueWithoutOcr': {
      if (!state.draft) return state;
      return { ...state, draft: applyOcrStatus(state.draft, 'unavailable', '') };
    }

    /**
     * The draft has been written to the database, so it should stop being held
     * here. Saving is asynchronous and lives in the data layer, so the screen
     * performs it and then dispatches this.
     */
    case 'draft/clear':
      return { ...state, draft: null };

    case 'draft/discard':
      return { ...state, draft: null, status: { tone: 'info', text: 'Draft discarded.' } };

    case 'failure/toggle': {
      const next = { ...state.failures, [action.key]: !state.failures[action.key] };
      // Turning on OCR failure while the draft expects success should show
      // the failure state, so re-evaluate rather than leaving a stale status.
      if (action.key === 'ocrFailure' && state.draft) {
        return {
          ...state,
          failures: next,
          draft: withOcr(state.draft, state.draft.ocrEnabled, next.ocrFailure),
        };
      }
      return { ...state, failures: next };
    }

    case 'failure/reset':
      return { ...state, failures: { ...noFailures } };

    case 'status/set':
      return { ...state, status: action.status };

    case 'status/clear':
      return { ...state, status: null };

    default:
      return state;
  }
}

type StoreValue = {
  state: StoreState;
  dispatch: (action: StoreAction) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const value = useMemo<StoreValue>(() => ({ state, dispatch }), [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error('useStore must be used inside <StoreProvider>');
  }
  return value;
}

/**
 * Sample PDFs for the still-simulated PDF import path. Photos no longer use
 * this: they come from the system photo library through the data layer.
 */
export function usePdfSamples(): MockSourceItem[] {
  return MOCK_PDF_SOURCES;
}
