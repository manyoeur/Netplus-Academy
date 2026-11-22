import React, { useEffect, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Minus,
  Plus,
  Table2,
  X
} from 'lucide-react';

export type MarkdownTableAlignment = 'left' | 'center' | 'right';

export interface ParsedMarkdownTable {
  headers: string[];
  alignments: MarkdownTableAlignment[];
  rows: string[][];
}

const TABLE_SEPARATOR_CELL_RE = /^:?-{3,}:?$/;
const MAX_PICKER_COLS = 8;
const MAX_PICKER_ROWS = 6;
const MIN_TABLE_COLS = 1;
const MAX_TABLE_COLS = 10;
const MIN_TABLE_ROWS = 1;
const MAX_TABLE_ROWS = 30;

export function clampTableDimensions(cols: number, rows: number): { cols: number; rows: number } {
  return {
    cols: Math.round(Math.min(MAX_TABLE_COLS, Math.max(MIN_TABLE_COLS, Number.isFinite(cols) ? cols : 2))),
    rows: Math.round(Math.min(MAX_TABLE_ROWS, Math.max(MIN_TABLE_ROWS, Number.isFinite(rows) ? rows : 2)))
  };
}

export function splitMarkdownTableRow(row: string): string[] {
  const trimmed = row.trim();
  const stripped = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === '\\' && stripped[i + 1] === '|') {
      current += '|';
      i += 1;
    } else if (stripped[i] === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += stripped[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseTableAlignments(separatorLine: string): MarkdownTableAlignment[] | null {
  if (!separatorLine.includes('|')) return null;
  const cells = splitMarkdownTableRow(separatorLine);
  if (cells.length === 0) return null;
  const alignments: MarkdownTableAlignment[] = [];
  for (const cell of cells) {
    if (!TABLE_SEPARATOR_CELL_RE.test(cell)) return null;
    if (cell.startsWith(':') && cell.endsWith(':')) {
      alignments.push('center');
    } else if (cell.endsWith(':')) {
      alignments.push('right');
    } else {
      alignments.push('left');
    }
  }
  return alignments;
}

export function isMarkdownTableStart(lines: string[], index: number): boolean {
  if (index + 1 >= lines.length) return false;
  const headerLine = lines[index];
  const separatorLine = lines[index + 1];
  if (!headerLine.includes('|')) return false;
  const alignments = parseTableAlignments(separatorLine);
  if (!alignments) return false;
  const headerCells = splitMarkdownTableRow(headerLine);
  return headerCells.length > 0 && headerCells.length === alignments.length;
}

export function escapeMarkdownTableCell(cell: string): string {
  return cell
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim();
}

export function formatMarkdownTableRow(cells: string[]): string {
  return `| ${cells.map(escapeMarkdownTableCell).join(' | ')} |`;
}

export function formatTableSeparatorRow(alignments: MarkdownTableAlignment[]): string {
  return `| ${alignments
    .map(align => (align === 'center' ? ':---:' : align === 'right' ? '---:' : '---'))
    .join(' | ')} |`;
}

export function serializeMarkdownTable(table: ParsedMarkdownTable): string {
  const colCount = Math.max(1, table.headers.length);
  const headers = Array.from({ length: colCount }, (_, idx) => table.headers[idx] ?? `Column ${idx + 1}`);
  const alignments = Array.from({ length: colCount }, (_, idx) => table.alignments[idx] ?? 'left');
  const lines: string[] = [
    formatMarkdownTableRow(headers),
    formatTableSeparatorRow(alignments),
    ...table.rows.map(row =>
      formatMarkdownTableRow(Array.from({ length: colCount }, (_, idx) => row[idx] ?? ''))
    )
  ];
  return lines.join('\n');
}

export function generateMarkdownTableTemplate(
  cols: number,
  rows: number,
  alignment: MarkdownTableAlignment = 'left',
  includeSampleHeaders = true
): string {
  const clamped = clampTableDimensions(cols, rows);
  const headers = Array.from({ length: clamped.cols }, (_, idx) =>
    includeSampleHeaders ? `Column ${idx + 1}` : ''
  );
  const alignments: MarkdownTableAlignment[] = Array.from(
    { length: clamped.cols },
    () => alignment
  );
  const bodyRows = Array.from({ length: clamped.rows }, () =>
    Array.from({ length: clamped.cols }, () => '')
  );
  return serializeMarkdownTable({ headers, alignments, rows: bodyRows });
}

export function updateMarkdownTableAtIndex(
  markdown: string,
  targetTableIndex: number,
  updater: (current: ParsedMarkdownTable) => ParsedMarkdownTable
): string {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let i = 0;
  let tableIndex = 0;
  let inCodeFence = false;
  const output: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inCodeFence = !inCodeFence;
      output.push(line);
      i += 1;
      continue;
    }

    if (!inCodeFence && isMarkdownTableStart(lines, i)) {
      const headers = splitMarkdownTableRow(lines[i]);
      const alignments = parseTableAlignments(lines[i + 1]) || headers.map(() => 'left' as const);
      let j = i + 2;
      const bodyRows: string[][] = [];
      while (
        j < lines.length &&
        lines[j].trim() &&
        lines[j].includes('|') &&
        !lines[j].trim().startsWith('```')
      ) {
        const rawCells = splitMarkdownTableRow(lines[j]);
        bodyRows.push(headers.map((_, colIdx) => rawCells[colIdx] ?? ''));
        j += 1;
      }

      if (tableIndex === targetTableIndex) {
        const updated = updater({ headers, alignments, rows: bodyRows });
        output.push(...serializeMarkdownTable(updated).split('\n'));
      } else {
        output.push(...lines.slice(i, j));
      }

      tableIndex += 1;
      i = j;
      continue;
    }

    output.push(line);
    i += 1;
  }

  return output.join('\n');
}

interface MarkdownTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (tableMarkdown: string) => void;
}

export const MarkdownTableModal: React.FC<MarkdownTableModalProps> = ({
  isOpen,
  onClose,
  onInsert
}) => {
  const [cols, setCols] = useState<number>(2);
  const [rows, setRows] = useState<number>(3);
  const [colsText, setColsText] = useState<string>('2');
  const [rowsText, setRowsText] = useState<string>('3');
  const [alignment, setAlignment] = useState<MarkdownTableAlignment>('left');
  const [hoverCell, setHoverCell] = useState<{ cols: number; rows: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCols(2);
    setRows(3);
    setColsText('2');
    setRowsText('3');
    setAlignment('left');
    setHoverCell(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeCols = hoverCell?.cols ?? cols;
  const activeRows = hoverCell?.rows ?? rows;

  const setSyncedCols = (next: number) => {
    const clamped = clampTableDimensions(next, rows).cols;
    setCols(clamped);
    setColsText(String(clamped));
  };

  const setSyncedRows = (next: number) => {
    const clamped = clampTableDimensions(cols, next).rows;
    setRows(clamped);
    setRowsText(String(clamped));
  };

  const handleConfirm = () => {
    const parsedCols = colsText.trim() === '' ? cols : Number(colsText);
    const parsedRows = rowsText.trim() === '' ? rows : Number(rowsText);
    const clamped = clampTableDimensions(parsedCols, parsedRows);
    const markdown = generateMarkdownTableTemplate(clamped.cols, clamped.rows, alignment, true);
    onInsert(markdown);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insert-table-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Table2 className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="insert-table-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                Insert Editable Table
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Choose row and column counts for your course content grid
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close insert table dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Interactive Quick-Pick Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Quick Grid Picker
              </span>
              <span className="font-mono text-[11px] text-blue-600 dark:text-cyan-400 tabular-nums font-semibold">
                {activeCols} {activeCols === 1 ? 'column' : 'columns'} × {activeRows}{' '}
                {activeRows === 1 ? 'row' : 'rows'} (+ header)
              </span>
            </div>

            <div
              onMouseLeave={() => setHoverCell(null)}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-1.5"
            >
              {Array.from({ length: MAX_PICKER_ROWS }, (_, rIdx) => {
                const rNum = rIdx + 1;
                return (
                  <div key={rNum} className="flex items-center gap-1.5">
                    {Array.from({ length: MAX_PICKER_COLS }, (_, cIdx) => {
                      const cNum = cIdx + 1;
                      const isHighlighted = rNum <= activeRows && cNum <= activeCols;
                      return (
                        <button
                          key={cNum}
                          type="button"
                          onMouseEnter={() => setHoverCell({ cols: cNum, rows: rNum })}
                          onFocus={() => setHoverCell({ cols: cNum, rows: rNum })}
                          onClick={() => {
                            setSyncedCols(cNum);
                            setSyncedRows(rNum);
                            setHoverCell(null);
                          }}
                          aria-label={`Select ${cNum} columns by ${rNum} rows`}
                          className={`w-7 h-5 rounded border transition-colors ${
                            isHighlighted
                              ? rNum === 1
                                ? 'bg-[#1e3a8a] border-[#1e3a8a] dark:bg-blue-700 dark:border-blue-600'
                                : 'bg-blue-100 border-blue-500 dark:bg-blue-900/60 dark:border-cyan-500'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                          }`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exact Columns & Rows Steppers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="table-cols-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Columns (1–{MAX_TABLE_COLS})
              </label>
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSyncedCols(cols - 1)}
                  disabled={cols <= MIN_TABLE_COLS}
                  className="px-2.5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  aria-label="Decrease columns"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  id="table-cols-input"
                  type="number"
                  min={MIN_TABLE_COLS}
                  max={MAX_TABLE_COLS}
                  value={colsText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setColsText(raw);
                    if (raw.trim() !== '' && Number.isFinite(Number(raw))) {
                      setCols(clampTableDimensions(Number(raw), rows).cols);
                    }
                  }}
                  onBlur={() => setSyncedCols(colsText.trim() === '' ? cols : Number(colsText))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleConfirm();
                    }
                  }}
                  className="w-full py-2 text-center text-sm font-mono font-bold tabular-nums bg-transparent text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSyncedCols(cols + 1)}
                  disabled={cols >= MAX_TABLE_COLS}
                  className="px-2.5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  aria-label="Increase columns"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="table-rows-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Body Rows (1–{MAX_TABLE_ROWS})
              </label>
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSyncedRows(rows - 1)}
                  disabled={rows <= MIN_TABLE_ROWS}
                  className="px-2.5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  aria-label="Decrease rows"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  id="table-rows-input"
                  type="number"
                  min={MIN_TABLE_ROWS}
                  max={MAX_TABLE_ROWS}
                  value={rowsText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setRowsText(raw);
                    if (raw.trim() !== '' && Number.isFinite(Number(raw))) {
                      setRows(clampTableDimensions(cols, Number(raw)).rows);
                    }
                  }}
                  onBlur={() => setSyncedRows(rowsText.trim() === '' ? rows : Number(rowsText))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleConfirm();
                    }
                  }}
                  className="w-full py-2 text-center text-sm font-mono font-bold tabular-nums bg-transparent text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSyncedRows(rows + 1)}
                  disabled={rows >= MAX_TABLE_ROWS}
                  className="px-2.5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  aria-label="Increase rows"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Default Alignment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Default Text Alignment
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'left', label: 'Left', icon: AlignLeft },
                  { id: 'center', label: 'Center', icon: AlignCenter },
                  { id: 'right', label: 'Right', icon: AlignRight }
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const selected = alignment === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAlignment(opt.id)}
                    aria-pressed={selected}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                      selected
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleConfirm();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>
              Insert {cols}×{rows} Table
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
