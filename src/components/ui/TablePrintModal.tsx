import React, { useMemo } from 'react';
import { X, Printer, FileText, Calendar } from 'lucide-react';
import { useApp } from '../../context/SupabaseAppContext';
import { format } from 'date-fns';

export interface PrintColumn<T = any> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

export interface PrintSummary {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface PrintFilterInfo {
  label: string;
  value: string;
}

interface TablePrintModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  columns: PrintColumn<T>[];
  data: T[];
  summaries?: PrintSummary[];
  filters?: PrintFilterInfo[];
  reportDateField?: string;
  orientation?: 'portrait' | 'landscape';
  emptyMessage?: string;
}

function mm(n: number): string {
  return `${n.toFixed(3)}mm`;
}

const A4_CONFIG = {
  pageWidthMm: 297,
  pageHeightMm: 210,
  portraitWidthMm: 210,
  portraitHeightMm: 297,
  marginXMm: 10,
  marginYMm: 10,
  firstPageHeaderMm: 24,
  tableHeaderHeightMm: 5,
  tableRowHeightMm: 3.85,
  summaryFooterMm: 6,
};

const PRINT_FONT = 'Arial, Helvetica, sans-serif';
const CELL_BORDER = '0.15mm solid #000000';
const HEADER_RULE = '0.55mm solid #000000';
const ROW_STRIPE = '#f2f2f2';

export function TablePrintModal<T>({
  isOpen,
  onClose,
  title,
  subtitle,
  columns,
  data,
  summaries,
  filters,
  orientation = 'landscape',
  emptyMessage = 'No data to display',
}: TablePrintModalProps<T>) {
  const { state } = useApp();

  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? A4_CONFIG.pageWidthMm : A4_CONFIG.portraitWidthMm;
  const pageH = isLandscape ? A4_CONFIG.pageHeightMm : A4_CONFIG.portraitHeightMm;
  const contentW = pageW - A4_CONFIG.marginXMm * 2;

  const rowsPerPageFirst = useMemo(() => {
    const used =
      A4_CONFIG.marginYMm * 2 +
      A4_CONFIG.firstPageHeaderMm +
      (filters && filters.length > 0 ? 3 : 0) +
      A4_CONFIG.tableHeaderHeightMm +
      1;
    const remaining = pageH - used;
    return Math.max(8, Math.floor(remaining / A4_CONFIG.tableRowHeightMm));
  }, [pageH, filters]);

  const rowsPerPageRest = useMemo(() => {
    const used =
      A4_CONFIG.marginYMm * 2 +
      A4_CONFIG.tableHeaderHeightMm +
      1;
    const remaining = pageH - used;
    return Math.max(12, Math.floor(remaining / A4_CONFIG.tableRowHeightMm));
  }, [pageH]);

  const pageSlices = useMemo(() => {
    if (data.length === 0) {
      return [{ start: 0, end: 0, isFirst: true, isLast: true }];
    }
    const slices: { start: number; end: number; isFirst: boolean; isLast: boolean }[] = [];
    let idx = 0;
    let first = true;
    while (idx < data.length) {
      const limit = first ? rowsPerPageFirst : rowsPerPageRest;
      const end = Math.min(idx + limit, data.length);
      slices.push({ start: idx, end, isFirst: first, isLast: false });
      idx = end;
      first = false;
    }
    if (slices.length > 0) {
      slices[slices.length - 1].isLast = true;
    }
    return slices;
  }, [data.length, rowsPerPageFirst, rowsPerPageRest]);

  const totalPages = pageSlices.length;

  const storeName = state.settings.storeName || 'Business Report';
  const generatedAt = format(new Date(), 'M/d/yyyy, h:mm:ss a');

  const reportDateLabel = useMemo(() => {
    const dateFilter = filters?.find((f) => /date/i.test(f.label));
    if (dateFilter?.value) return dateFilter.value;
    if (subtitle) return subtitle;
    return format(new Date(), 'd MMMM yyyy');
  }, [filters, subtitle]);

  const handlePrint = () => {
    setTimeout(() => {
      const sheetEl = document.getElementById('table-print-sheet');
      if (!sheetEl) {
        console.error('Table print root not found.');
        return;
      }

      const clone = sheetEl.cloneNode(true) as HTMLElement;
      clone.id = 'table-print-root';
      clone.style.position = 'absolute';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.zIndex = '999999';
      clone.style.background = '#ffffff';
      clone.style.display = 'block';
      clone.style.visibility = 'visible';
      clone.style.margin = '0';
      clone.style.padding = '0';
      clone.style.boxSizing = 'border-box';

      const bodyChildren = Array.from(document.body.children) as HTMLElement[];
      bodyChildren.forEach((child) => {
        child.classList.add('print-body-hidden');
      });

      document.body.appendChild(clone);
      clone.classList.add('print-body-visible');
      clone.setAttribute('data-print-orientation', orientation);

      window.print();

      setTimeout(() => {
        clone.remove();
        bodyChildren.forEach((child) => {
          child.classList.remove('print-body-hidden');
        });
      }, 500);
    }, 150);
  };

  if (!isOpen) return null;

  const renderReportHeader = (showFull: boolean) => {
    if (!showFull) return null;
    return (
      <div
        style={{
          textAlign: 'center',
          fontFamily: PRINT_FONT,
          color: '#000000',
          marginBottom: mm(2),
        }}
      >
        <div
          style={{
            fontSize: '17pt',
            fontWeight: 700,
            textTransform: 'uppercase',
            lineHeight: 1.15,
            letterSpacing: '0.02em',
          }}
        >
          {storeName}
        </div>
        <div
          style={{
            fontSize: '13pt',
            fontWeight: 700,
            marginTop: mm(1.2),
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: '10pt', marginTop: mm(1), lineHeight: 1.25 }}>
          Date: {reportDateLabel}
        </div>
        <div style={{ fontSize: '8pt', marginTop: mm(0.6), lineHeight: 1.25 }}>
          Generated on: {generatedAt}
        </div>
        {filters && filters.length > 0 && (
          <div
            style={{
              fontSize: '8pt',
              marginTop: mm(1.2),
              lineHeight: 1.35,
              color: '#000000',
            }}
          >
            {filters
              .filter((f) => !/date/i.test(f.label))
              .map((f, i) => (
                <div key={i}>
                  {f.label}: {f.value}
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  const renderPages = () => {
    const pages: JSX.Element[] = [];

    pageSlices.forEach((slice, p) => {
      const pageData = data.slice(slice.start, slice.end);

      pages.push(
        <div
          key={`page-${p}`}
          style={{
            width: mm(pageW),
            height: mm(pageH),
            position: 'relative',
            pageBreakAfter: p < totalPages - 1 ? 'always' : 'auto',
            breakAfter: p < totalPages - 1 ? 'page' : 'auto',
            overflow: 'hidden',
            background: '#ffffff',
            boxSizing: 'border-box',
            margin: 0,
            padding: `${mm(A4_CONFIG.marginYMm)} ${mm(A4_CONFIG.marginXMm)}`,
            fontFamily: PRINT_FONT,
          }}
        >
          {renderReportHeader(slice.isFirst)}

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontFamily: PRINT_FONT,
              fontSize: '8pt',
              color: '#000000',
            }}
          >
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th
                    key={i}
                    style={{
                      fontWeight: 700,
                      textAlign: col.align || 'left',
                      padding: `${mm(0.9)} ${mm(1.2)}`,
                      fontSize: '8pt',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: col.width || 'auto',
                      border: CELL_BORDER,
                      borderTop: HEADER_RULE,
                      borderBottom: HEADER_RULE,
                      verticalAlign: 'middle',
                      lineHeight: 1.15,
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 && slice.isFirst ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{
                      textAlign: 'center',
                      padding: mm(6),
                      fontSize: '9pt',
                      fontStyle: 'italic',
                      border: CELL_BORDER,
                    }}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pageData.map((row, ri) => (
                  <tr
                    key={ri}
                    style={{
                      background: ri % 2 === 0 ? '#ffffff' : ROW_STRIPE,
                    }}
                  >
                    {columns.map((col, ci) => {
                      const val = col.accessor(row);
                      const align = col.align || 'left';
                      return (
                        <td
                          key={ci}
                          style={{
                            textAlign: align,
                            padding: `${mm(0.65)} ${mm(1.2)}`,
                            verticalAlign: 'middle',
                            border: CELL_BORDER,
                            wordBreak: 'break-word',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: '8pt',
                            lineHeight: 1.15,
                            fontVariantNumeric: align === 'right' ? 'tabular-nums' : 'normal',
                            textTransform:
                              align === 'right' || align === 'center' ? 'none' : 'uppercase',
                          }}
                        >
                          {typeof val === 'string' || typeof val === 'number' ? val : val}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
            {slice.isLast && summaries && summaries.length > 0 && (
              <tfoot>
                {summaries.map((s, si) => (
                  <tr key={si}>
                    {columns.length > 1 ? (
                      <>
                        <td
                          colSpan={columns.length - 1}
                          style={{
                            border: 'none',
                            borderTop: si === 0 ? HEADER_RULE : 'none',
                            padding: `${mm(1)} ${mm(1.2)}`,
                            textAlign: 'right',
                            fontWeight: 700,
                            fontSize: '9pt',
                            background: '#ffffff',
                          }}
                        >
                          {s.label}:
                        </td>
                        <td
                          style={{
                            border: 'none',
                            borderTop: si === 0 ? HEADER_RULE : 'none',
                            padding: `${mm(1)} ${mm(1.2)}`,
                            textAlign: 'right',
                            fontWeight: 700,
                            fontSize: '9pt',
                            fontVariantNumeric: 'tabular-nums',
                            background: '#ffffff',
                          }}
                        >
                          {s.value}
                        </td>
                      </>
                    ) : (
                      <td
                        colSpan={1}
                        style={{
                          border: 'none',
                          borderTop: si === 0 ? HEADER_RULE : 'none',
                          padding: `${mm(1)} ${mm(1.2)}`,
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '9pt',
                          background: '#ffffff',
                        }}
                      >
                        {s.label}: {s.value}
                      </td>
                    )}
                  </tr>
                ))}
              </tfoot>
            )}
          </table>

          {totalPages > 1 && (
            <div
              style={{
                marginTop: mm(2),
                textAlign: 'right',
                fontSize: '7.5pt',
                color: '#000000',
              }}
            >
              Page {p + 1} of {totalPages}
            </div>
          )}
        </div>
      );
    });

    return pages;
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-5xl">
        <div className="modal-header no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Printer className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Print Report</h2>
              <p className="text-sm text-gray-500">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="modal-body no-print space-y-4">
          {filters && filters.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">Applied Filters</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {filters.map((f, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-blue-700 font-medium">{f.label}: </span>
                    <span className="text-blue-900 font-bold">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
            <div className="text-gray-600">
              <span className="font-semibold text-gray-900">{data.length}</span> records ·{' '}
              <span className="font-semibold text-gray-900">{totalPages}</span> page{totalPages !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <FileText className="h-4 w-4" />
              <span>A4 {orientation} · 96 DPI</span>
            </div>
          </div>

          <div className="bg-gray-100 border border-gray-200 rounded-2xl p-4 overflow-auto" style={{ maxHeight: '60vh' }}>
            <div
              style={{
                transform: `scale(${isLandscape ? 0.65 : 0.55})`,
                transformOrigin: 'top left',
                width: isLandscape ? `${A4_CONFIG.pageWidthMm * 3.7795}px` : `${A4_CONFIG.portraitWidthMm * 3.7795}px`,
                height: isLandscape ? `${A4_CONFIG.pageHeightMm * 3.7795 * totalPages + 40 * totalPages}px` : `${A4_CONFIG.portraitHeightMm * 3.7795 * totalPages + 40 * totalPages}px`,
                position: 'relative',
                flexShrink: 0,
              }}
            >
              {renderPages()}
            </div>
          </div>
        </div>

        <div
          id="table-print-sheet"
          style={{ display: 'none' }}
        >
          {renderPages()}
        </div>

        <div className="modal-footer no-print">
          <button onClick={onClose} className="btn btn-secondary btn-md">
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={data.length === 0}
            className="btn btn-primary btn-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </button>
        </div>

        <style>{`
          @page {
            margin: 0;
          }
          @page table-landscape {
            size: A4 landscape;
            margin: 0;
          }
          @page table-portrait {
            size: A4 portrait;
            margin: 0;
          }
          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: auto !important;
              height: auto !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print { display: none !important; }
            .print-body-hidden { display: none !important; }
            .print-body-visible {
              display: block !important;
              visibility: visible !important;
            }
            #table-print-root,
            #table-print-root * {
              visibility: visible !important;
            }
            #table-print-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              box-sizing: border-box !important;
              visibility: visible !important;
            }
            #table-print-root[data-print-orientation="landscape"] {
              page: table-landscape !important;
            }
            #table-print-root[data-print-orientation="portrait"] {
              page: table-portrait !important;
            }
            #table-print-root > div {
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
              -webkit-column-break-inside: avoid;
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
