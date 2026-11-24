import { NetworkDiagramDocument } from './networkDiagramData';

export const MAX_DIAGRAM_HISTORY_STEPS = 50;
export const COALESCE_EDIT_WINDOW_MS = 1000;

export interface DiagramHistoryState {
  past: NetworkDiagramDocument[];
  present: NetworkDiagramDocument;
  future: NetworkDiagramDocument[];
  activeEditKey: string | null;
  lastEditTimestamp: number;
}

export type DiagramHistoryAction =
  | {
      type: 'COMMIT';
      updater: (prev: NetworkDiagramDocument) => NetworkDiagramDocument;
    }
  | {
      type: 'PREVIEW';
      updater: (prev: NetworkDiagramDocument) => NetworkDiagramDocument;
    }
  | {
      type: 'COMMIT_DRAG';
      preDragDoc: NetworkDiagramDocument;
      nextDoc: NetworkDiagramDocument;
    }
  | {
      type: 'COALESCED_EDIT';
      editKey: string;
      now: number;
      updater: (prev: NetworkDiagramDocument) => NetworkDiagramDocument;
    }
  | { type: 'END_EDIT_SESSION' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export function cloneDiagramDocument(doc: NetworkDiagramDocument): NetworkDiagramDocument {
  return {
    name: doc.name,
    nodes: doc.nodes.map(n => ({ ...n })),
    cables: doc.cables.map(c => ({ ...c })),
    zones: doc.zones.map(z => ({ ...z }))
  };
}

export function createInitialDiagramHistory(
  initialDoc: NetworkDiagramDocument
): DiagramHistoryState {
  return {
    past: [],
    present: cloneDiagramDocument(initialDoc),
    future: [],
    activeEditKey: null,
    lastEditTimestamp: 0
  };
}

export function diagramHistoryReducer(
  state: DiagramHistoryState,
  action: DiagramHistoryAction
): DiagramHistoryState {
  switch (action.type) {
    case 'COMMIT': {
      const next = cloneDiagramDocument(action.updater(state.present));
      return {
        past: [...state.past.slice(-(MAX_DIAGRAM_HISTORY_STEPS - 1)), cloneDiagramDocument(state.present)],
        present: next,
        future: [],
        activeEditKey: null,
        lastEditTimestamp: 0
      };
    }

    case 'PREVIEW': {
      return {
        ...state,
        present: action.updater(state.present)
      };
    }

    case 'COMMIT_DRAG': {
      return {
        past: [...state.past.slice(-(MAX_DIAGRAM_HISTORY_STEPS - 1)), cloneDiagramDocument(action.preDragDoc)],
        present: cloneDiagramDocument(action.nextDoc),
        future: [],
        activeEditKey: null,
        lastEditTimestamp: 0
      };
    }

    case 'COALESCED_EDIT': {
      const next = cloneDiagramDocument(action.updater(state.present));
      const withinWindow =
        state.activeEditKey === action.editKey &&
        action.now - state.lastEditTimestamp < COALESCE_EDIT_WINDOW_MS;

      if (withinWindow) {
        return {
          ...state,
          present: next,
          lastEditTimestamp: action.now
        };
      }

      return {
        past: [...state.past.slice(-(MAX_DIAGRAM_HISTORY_STEPS - 1)), cloneDiagramDocument(state.present)],
        present: next,
        future: [],
        activeEditKey: action.editKey,
        lastEditTimestamp: action.now
      };
    }

    case 'END_EDIT_SESSION': {
      if (state.activeEditKey === null) return state;
      return {
        ...state,
        activeEditKey: null,
        lastEditTimestamp: 0
      };
    }

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: cloneDiagramDocument(previous),
        future: [
          ...state.future.slice(-(MAX_DIAGRAM_HISTORY_STEPS - 1)),
          cloneDiagramDocument(state.present)
        ],
        activeEditKey: null,
        lastEditTimestamp: 0
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[state.future.length - 1];
      return {
        past: [
          ...state.past.slice(-(MAX_DIAGRAM_HISTORY_STEPS - 1)),
          cloneDiagramDocument(state.present)
        ],
        present: cloneDiagramDocument(next),
        future: state.future.slice(0, -1),
        activeEditKey: null,
        lastEditTimestamp: 0
      };
    }

    default:
      return state;
  }
}
