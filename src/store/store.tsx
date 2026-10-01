/**
 * In-memory store for the Dastavez prototype.
 *
 * One reducer holds every document, the working draft, and the developer
 * failure toggles. All transitions go through `dispatch`, which keeps the mock
 * layer readable in a single place and avoids setState-in-effect entirely.
 *
 * Nothing here persists. A restart resets to the seed documents.
 */

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { createSeedDocuments, MOCK_SOURCES, nextPageId, resetPageIds, takeCapturePage } from './seed';
import type {
  Draft,
  FailureFlags,
  FileKind,
  MockDocument,
  MockPage,
  MockSourceItem,
  OcrStatus,
  PageFilter,
  SourceKind,
  StatusMessage,
} from './types';

export type UnlockState = 'locked' | 'unlocked';

type StoreState = {
  /** False until Welcome is dismissed. Drives the first-launch redirect. */
  hasSeenWelcome: boolean;
  unlockState: UnlockState;
  documents: MockDocument[];
  draft: Draft | null;
  /** Id of the most recently saved document, so Save can open it. */
  lastSavedId: string | null;
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
    documents: createSeedDocuments(),
    draft: null,
    lastSavedId: null,
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
  | { type: 'draft/addPage' }
  | { type: 'draft/retakePage'; pageId: string }
  | { type: 'draft/removePage'; pageId: string }
  | { type: 'draft/rotatePage'; pageId: string }
  | { type: 'draft/reorderPages'; from: number; to: number }
  | { type: 'draft/setFilter'; pageId: string; filter: PageFilter }
  | { type: 'draft/setTitle'; title: string }
  | { type: 'draft/setExportFormat'; exportAsPdf: boolean }
  | { type: 'draft/setOcrEnabled'; enabled: boolean }
  | { type: 'draft/retryOcr' }
  | { type: 'draft/continueWithoutOcr' }
  | { type: 'draft/save' }
  | { type: 'draft/discard' }
  | { type: 'document/delete'; id: string }
  | { type: 'failure/toggle'; key: keyof FailureFlags }
  | { type: 'failure/reset' }
  | { type: 'library/deleteAll' }
  | { type: 'status/set'; status: StatusMessage }
  | { type: 'status/clear' };

function reindex(pages: MockPage[]): MockPage[] {
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
 * screens, so the reviewer's mental model stays "one place decides state".
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

/** Title used when the reviewer leaves the field blank. */
export const UNTITLED = 'Untitled document';

/**
 * Builds the id a document will be saved under.
 *
 * Exported because Edit & Save needs to know the id at the moment the Save
 * button is pressed, so it can open the document straight away. Keeping this in
 * one place stops the predicted id from drifting away from the real one — which
 * would send the reviewer to a "not found" screen right after saving.
 */
export function buildDocumentId(title: string, existing: MockDocument[]): string {
  const trimmed = title.trim() || UNTITLED;
  const base = `doc-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return existing.some((doc) => doc.id === base) ? `${base}-${existing.length + 1}` : base;
}

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
      const pages = Array.from({ length: action.item.pageCount }, (_, index) => ({
        id: nextPageId(),
        order: index,
        label: labelFor(index),
        rotation: 0,
        filter: 'original' as const,
      }));
      const fileType: FileKind = action.item.kind;
      const draft: Draft = {
        origin: 'import',
        pages,
        title: action.item.title.replace(/\.pdf$/i, ''),
        exportAsPdf: fileType === 'pdf',
        ocrEnabled: true,
        ocrStatus: 'complete',
        ocrText: SAMPLE_OCR_TEXT,
      };
      return { ...state, draft, status: null };
    }

    /**
     * Several items chosen in one picker pass. Handled here rather than by
     * repeated `draft/addPage` dispatches because that action draws from the
     * capture pool, which would give imported photos the wrong page labels.
     * A PDF alongside photos still produces a PDF, since the PDF decides format.
     */
    case 'draft/startImportMany': {
      const items = action.items;
      if (items.length === 0) return state;

      const pages = items.flatMap((item) =>
        Array.from({ length: item.pageCount }, (_, index) => ({
          id: nextPageId(),
          order: 0,
          label: labelFor(index),
          rotation: 0,
          filter: 'original' as const,
        })),
      );

      const containsPdf = items.some((item) => item.kind === 'pdf');
      const title =
        items.length === 1
          ? items[0].title.replace(/\.pdf$/i, '')
          : `${items.length} imported items`;

      const draft: Draft = {
        origin: 'import',
        pages: reindex(pages),
        title,
        exportAsPdf: containsPdf,
        ocrEnabled: true,
        ocrStatus: 'complete',
        ocrText: SAMPLE_OCR_TEXT,
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

    case 'draft/save': {
      if (!state.draft) return state;
      const { draft } = state;
      if (draft.pages.length === 0) return state;

      const title = draft.title.trim() || UNTITLED;
      const id = buildDocumentId(draft.title, state.documents);
      const today = new Date().toISOString().slice(0, 10);

      const document: MockDocument = {
        id,
        title,
        date: today,
        fileType: draft.exportAsPdf ? 'pdf' : 'jpeg',
        pages: reindex(draft.pages.map((page) => ({ ...page, id: nextPageId() }))),
        ocrStatus: draft.ocrStatus,
        ocrText: draft.ocrText,
      };

      return {
        ...state,
        documents: [document, ...state.documents],
        draft: null,
        lastSavedId: document.id,
        status: { tone: 'success', text: `Saved “${title}”.` },
      };
    }

    case 'draft/discard':
      return { ...state, draft: null, status: { tone: 'info', text: 'Draft discarded.' } };

    case 'document/delete':
      return {
        ...state,
        documents: state.documents.filter((doc) => doc.id !== action.id),
        status: { tone: 'info', text: 'Document deleted.' },
      };

    case 'failure/toggle': {
      const next = { ...state.failures, [action.key]: !state.failures[action.key] };
      // Turning on OCR failure while the draft expects success should show
      // the failure state, so re-evaluate rather than leaving a stale status.
      if (action.key === 'ocrFailure' && state.draft) {
        return { ...state, failures: next, draft: withOcr(state.draft, state.draft.ocrEnabled, next.ocrFailure) };
      }
      return { ...state, failures: next };
    }

    case 'failure/reset':
      return { ...state, failures: { ...noFailures } };

    case 'library/deleteAll':
      return { ...state, documents: [], status: { tone: 'info', text: 'All sample documents deleted.' } };

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
  /** Honours the empty-library toggle without duplicating the check in views. */
  visibleDocuments: MockDocument[];
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    resetPageIds();
    return createInitialState();
  });

  const value = useMemo<StoreValue>(() => {
    const visible = state.failures.emptyLibrary ? [] : state.documents;
    return { state, dispatch, visibleDocuments: visible };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error('useStore must be used inside <StoreProvider>');
  }
  return value;
}

/** Convenience selector for the most common question a screen asks. */
export function useDocument(id: string): MockDocument | undefined {
  const { state } = useStore();
  return state.documents.find((doc) => doc.id === id);
}

/** Sample items for the mock Photos or PDFs picker. */
export function useSourceItems(kind: SourceKind): MockSourceItem[] {
  return MOCK_SOURCES[kind];
}

