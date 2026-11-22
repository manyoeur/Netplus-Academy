import React, { useEffect, useRef, useState } from 'react';
import { Plus, Table2, Trash2 } from 'lucide-react';
import { MarkdownTableAlignment } from './MarkdownTableModal';

export interface EditableMarkdownTableProps {
  headers: string[];
  alignments: MarkdownTableAlignment[];
  rows: string[][];
  tableIndex?: number;
  editable?: boolean;
  renderCellText: (text: string) => React.ReactNode;
  onUpdateCell?: (
    tableIndex: number,
    section: 'header' | 'body',
    rowIndex: number,
    colIndex: number,
    value: string
  ) => void;
  onAddRow?: (tableIndex: number) => void;
  onRemoveRow?: (tableIndex: number, rowIndex: number) => void;
  onAddColumn?: (tableIndex: number) => void;
  onRemoveColumn?: (tableIndex: number, colIndex: number) => void;
}

interface ActiveCellState {
  section: 'header' | 'body';
  rowIndex: number;
  colIndex: number;
  text: string;
}

function toEditableMultiline(raw: string): string {
  return raw.replace(/<br\s*\/?>/gi, '\n');
}

function toMarkdownCell(text: string): string {
  return text.replace(/\r?\n/g, '<br>');
}

export const EditableMarkdownTable: React.FC<EditableMarkdownTableProps> = ({
  headers,
  alignments,
  rows,
  tableIndex,
  editable = false,
  renderCellText,
  onUpdateCell,
  onAddRow,
  onRemoveRow,
  onAddColumn,
  onRemoveColumn
}) => {
  const [activeCell, setActiveCell] = useState<ActiveCellState | null>(null);
  const cellTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!activeCell || !cellTextareaRef.current) return;
    const el = cellTextareaRef.current;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [activeCell?.section, activeCell?.rowIndex, activeCell?.colIndex]);

  const alignClass = (align: MarkdownTableAlignment) =>
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  const startEditingCell = (
    section: 'header' | 'body',
    rowIndex: number,
    colIndex: number,
    rawValue: string
  ) => {
    if (!editable || typeof tableIndex !== 'number') return;
    setActiveCell({
      section,
      rowIndex,
      colIndex,
      text: toEditableMultiline(rawValue)
    });
  };

  const handleCellTextChange = (nextText: string) => {
    if (!activeCell || typeof tableIndex !== 'number') return;
    setActiveCell({ ...activeCell, text: nextText });
    onUpdateCell?.(
      tableIndex,
      activeCell.section,
      activeCell.rowIndex,
      activeCell.colIndex,
      toMarkdownCell(nextText)
    );
  };

  const navigateCell = (direction: 1 | -1) => {
    if (!activeCell) return;
    const totalCols = headers.length;
    // Linearize: header row = 0, body rows = 1..rows.length
    const currentFlatRow = activeCell.section === 'header' ? 0 : activeCell.rowIndex + 1;
    const totalRows = 1 + rows.length;
    const linearIndex = currentFlatRow * totalCols + activeCell.colIndex + direction;
    const maxIndex = totalRows * totalCols - 1;

    if (linearIndex < 0 || linearIndex > maxIndex) {
      setActiveCell(null);
      return;
    }

    const nextFlatRow = Math.floor(linearIndex / totalCols);
    const nextCol = linearIndex % totalCols;
    if (nextFlatRow === 0) {
      startEditingCell('header', 0, nextCol, headers[nextCol] ?? '');
    } else {
      const nextBodyRow = nextFlatRow - 1;
      startEditingCell('body', nextBodyRow, nextCol, rows[nextBodyRow]?.[nextCol] ?? '');
    }
  };

  const renderRichCellLines = (cellText: string, isPlaceholderEligible: boolean) => {
    if (!cellText.trim()) {
      return isPlaceholderEligible ? (
        <span className="text-xs italic opacity-55">Click to edit...</span>
      ) : (
        <span>&nbsp;</span>
      );
    }
    const segments = cellText.split(/<br\s*\/?>/gi);
    return (
      <div className="space-y-1.5">
        {segments.map((segment, segIdx) => (
          <div key={segIdx} className="leading-relaxed">
            {segment.trim() ? renderCellText(segment.trim()) : <span>&nbsp;</span>}
          </div>
        ))}
      </div>
    );
  };

  const isCellActive = (section: 'header' | 'body', rowIndex: number, colIndex: number) =>
    activeCell?.section === section &&
    activeCell.rowIndex === rowIndex &&
    activeCell.colIndex === colIndex;

  return (
    <div className="clear-both my-4 space-y-1.5">
      {editable && typeof tableIndex === 'number' && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px]">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Table2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
            <span className="font-semibold tabular-nums">
              {headers.length} × {rows.length} Grid
            </span>
            <span className="hidden sm:inline text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline text-slate-500 dark:text-slate-400">
              Click any cell to edit · Enter for new line · Tab for next cell
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveCell(null);
                onAddRow?.(tableIndex);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-400 font-semibold transition-colors whitespace-nowrap"
            >
              <Plus className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
              <span>Add Row</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveCell(null);
                onAddColumn?.(tableIndex);
              }}
              disabled={headers.length >= 10}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-400 disabled:opacity-40 font-semibold transition-colors whitespace-nowrap"
            >
              <Plus className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
              <span>Add Column</span>
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1e3a8a] dark:bg-blue-950 text-white">
              {headers.map((header, colIdx) => {
                const editingThis = isCellActive('header', 0, colIdx);
                return (
                  <th
                    key={colIdx}
                    className={`group/th relative px-4 py-3 font-bold text-white border-b border-r last:border-r-0 border-blue-800/80 dark:border-blue-800 align-top ${alignClass(
                      alignments[colIdx] || 'left'
                    )} ${colIdx === 0 && headers.length === 2 ? 'w-[34%] min-w-[180px]' : 'min-w-[130px]'} ${
                      editable ? 'cursor-text hover:bg-blue-800/80 dark:hover:bg-blue-900/80 transition-colors' : ''
                    }`}
                    onClick={() => {
                      if (!editingThis) {
                        startEditingCell('header', 0, colIdx, header);
                      }
                    }}
                  >
                    {editingThis && activeCell ? (
                      <textarea
                        ref={cellTextareaRef}
                        rows={Math.max(1, Math.min(4, activeCell.text.split('\n').length))}
                        value={activeCell.text}
                        onChange={(e) => handleCellTextChange(e.target.value)}
                        onBlur={() => setActiveCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
                            e.preventDefault();
                            setActiveCell(null);
                          } else if (e.key === 'Tab') {
                            e.preventDefault();
                            navigateCell(e.shiftKey ? -1 : 1);
                          }
                        }}
                        className="w-full min-w-[110px] p-1.5 rounded bg-blue-950/90 text-white border border-cyan-300 text-sm font-bold leading-relaxed focus:outline-none resize-y"
                      />
                    ) : (
                      <div className="pr-5">
                        {renderRichCellLines(header, Boolean(editable))}
                      </div>
                    )}

                    {editable && typeof tableIndex === 'number' && headers.length > 1 && !editingThis && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCell(null);
                          onRemoveColumn?.(tableIndex, colIdx);
                        }}
                        title={`Remove column ${colIdx + 1}`}
                        aria-label={`Remove column ${colIdx + 1}`}
                        className="opacity-0 group-hover/th:opacity-100 focus:opacity-100 absolute top-1.5 right-1.5 p-1 rounded bg-blue-950/80 text-blue-200 hover:text-white hover:bg-red-600 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </th>
                );
              })}
              {editable && typeof tableIndex === 'number' && rows.length > 1 && (
                <th
                  className="w-9 px-1.5 py-3 border-b border-blue-800/80 dark:border-blue-800 text-center"
                  aria-label="Row actions"
                />
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-700/80">
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="group/tr bg-white dark:bg-slate-900/70">
                {row.map((cell, colIdx) => {
                  const editingThis = isCellActive('body', rowIdx, colIdx);
                  return (
                    <td
                      key={colIdx}
                      className={`px-4 py-3.5 text-slate-800 dark:text-slate-200 border-r last:border-r-0 border-slate-200 dark:border-slate-700/80 align-top ${alignClass(
                        alignments[colIdx] || 'left'
                      )} ${
                        editable
                          ? 'cursor-text hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors'
                          : ''
                      }`}
                      onClick={() => {
                        if (!editingThis) {
                          startEditingCell('body', rowIdx, colIdx, cell);
                        }
                      }}
                    >
                      {editingThis && activeCell ? (
                        <textarea
                          ref={cellTextareaRef}
                          rows={Math.max(2, Math.min(8, activeCell.text.split('\n').length))}
                          value={activeCell.text}
                          onChange={(e) => handleCellTextChange(e.target.value)}
                          onBlur={() => setActiveCell(null)}
                          onKeyDown={(e) => {
                            if (
                              e.key === 'Escape' ||
                              ((e.metaKey || e.ctrlKey) && e.key === 'Enter')
                            ) {
                              e.preventDefault();
                              setActiveCell(null);
                            } else if (e.key === 'Tab') {
                              e.preventDefault();
                              navigateCell(e.shiftKey ? -1 : 1);
                            }
                          }}
                          placeholder="Type cell content (Enter for new line, **bold**)..."
                          className="w-full min-w-[140px] p-2 rounded-md bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-2 border-blue-500 text-sm leading-relaxed focus:outline-none resize-y"
                        />
                      ) : (
                        renderRichCellLines(cell, Boolean(editable))
                      )}
                    </td>
                  );
                })}

                {editable && typeof tableIndex === 'number' && rows.length > 1 && (
                  <td className="w-9 px-1.5 py-3 text-center align-top bg-slate-50/60 dark:bg-slate-900">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setActiveCell(null);
                        onRemoveRow?.(tableIndex, rowIdx);
                      }}
                      title={`Delete row ${rowIdx + 1}`}
                      aria-label={`Delete row ${rowIdx + 1}`}
                      className="opacity-45 group-hover/tr:opacity-100 focus:opacity-100 p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
