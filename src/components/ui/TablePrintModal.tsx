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
  marginXMm: 8,
  marginYMm: 8,
  headerHeightMm: 24,
  summaryHeightMm: 18,
  footerHeightMm: 9,
  tableHeaderHeightMm: 6.5,
  tableRowHeightMm: 5.8,
};

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

  const rowsPerPage = useMemo(() => {
    const used =
      A4_CONFIG.headerHeightMm +
      (summaries && summaries.length > 0 ? A4_CONFIG.summaryHeightMm : 0) +
      A4_CONFIG.tableHeaderHeightMm +
      A4_CONFIG.footerHeightMm +
      A4_CONFIG.marginYMm * 2;
    const remaining = pageH - used - 6;
    return Math.max(5, Math.floor(remaining / A4_CONFIG.tableRowHeightMm));
  }, [pageH, summaries]);

  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));

  const storeName = state.settings.storeName || 'Business Report';
  const currency = state.settings.currency || 'LKR';
  const generatedAt = format(new Date(), 'yyyy-MM-dd HH:mm');

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

  const renderPages = () => {
    const pages: JSX.Element[] = [];

    for (let p = 0; p < totalPages; p++) {
      const startIdx = p * rowsPerPage;
      const endIdx = Math.min(startIdx + rowsPerPage, data.length);
      const pageData = data.slice(startIdx, endIdx);

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
            padding: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: mm(A4_CONFIG.marginXMm),
              top: mm(A4_CONFIG.marginYMm),
              right: mm(A4_CONFIG.marginXMm),
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                paddingBottom: mm(2),
                borderBottom: '0.2mm solid #1f2937',
                marginBottom: mm(1.5),
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '13pt',
                    fontWeight: 800,
                    color: '#111827',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.1,
                  }}
                >
                  {storeName}
                </div>
                <div
                  style={{
                    fontSize: '9pt',
                    fontWeight: 700,
                    color: '#1f2937',
                    marginTop: mm(0.8),
                  }}
                >
                  {title}
                </div>
                {subtitle && (
                  <div
                    style={{
                      fontSize: '7.5pt',
                      color: '#6b7280',
                      marginTop: mm(0.3),
                    }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: '6.8pt', color: '#4b5563' }}>
                <div style={{ fontWeight: 600 }}>Generated</div>
                <div style={{ fontFamily: 'monospace' }}>{generatedAt}</div>
                <div style={{ marginTop: mm(0.8), fontWeight: 600 }}>Page</div>
                <div style={{ fontFamily: 'monospace' }}>{p + 1} / {totalPages}</div>
              </div>
            </div>

            {filters && filters.length > 0 && p === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: mm(1.5),
                  padding: mm(1.2),
                  background: '#f9fafb',
                  borderRadius: mm(0.8),
                  marginBottom: mm(1.2),
                  fontSize: '7.2pt',
                }}
              >
                {filters.map((f, i) => (
                  <div key={i}>
                    <span style={{ color: '#6b7280', fontWeight: 600 }}>{f.label}: </span>
                    <span style={{ color: '#111827', fontWeight: 700 }}>{f.value}</span>
                  </div>
                ))}
              </div>
            )}

            {summaries && summaries.length > 0 && p === 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(summaries.length, 4)}, 1fr)`,
                  gap: mm(1.5),
                  marginBottom: mm(1.5),
                }}
              >
                {summaries.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      background: s.highlight ? '#fef3c7' : '#f3f4f6',
                      borderLeft: s.highlight ? '0.7mm solid #f59e0b' : '0.4mm solid #d1d5db',
                      padding: mm(1.3),
                      borderRadius: mm(0.8),
                    }}
                  >
                    <div
                      style={{
                        fontSize: '6.5pt',
                        color: '#6b7280',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontSize: '10pt',
                        fontWeight: 800,
                        color: s.highlight ? '#92400e' : '#111827',
                        marginTop: mm(0.4),
                      }}
                    >
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ overflow: 'hidden' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '7.5pt',
                  tableLayout: 'fixed',
                }}
              >
                <thead>
                  <tr style={{ background: '#1f2937' }}>
                    {columns.map((col, i) => (
                      <th
                        key={i}
                        style={{
                          color: '#ffffff',
                          fontWeight: 700,
                          textAlign: col.align || 'left',
                          padding: `${mm(0.9)} ${mm(1.2)}`,
                          fontSize: '6.8pt',
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: col.width || 'auto',
                          borderRight: i < columns.length - 1 ? '0.08mm solid #374151' : 'none',
                        }}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        style={{
                          textAlign: 'center',
                          padding: mm(8),
                          color: '#9ca3af',
                          fontSize: '9pt',
                          fontStyle: 'italic',
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
                          background: ri % 2 === 0 ? '#ffffff' : '#f9fafb',
                          borderBottom: '0.08mm solid #e5e7eb',
                        }}
                      >
                        {columns.map((col, ci) => {
                          const val = col.accessor(row);
                          return (
                            <td
                              key={ci}
                              style={{
                                textAlign: col.align || 'left',
                                padding: `${mm(0.6)} ${mm(1.2)}`,
                                color: '#1f2937',
                                verticalAlign: 'middle',
                                borderRight: ci < columns.length - 1 ? '0.04mm solid #f3f4f6' : 'none',
                                wordBreak: 'break-word',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontSize: '7.4pt',
                                lineHeight: 1.12,
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
              </table>
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingTop: mm(1.2),
                borderTop: '0.15mm solid #d1d5db',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '6.3pt',
                color: '#6b7280',
              }}
            >
              <div>
                <FileText style={{ display: 'inline', width: '7pt', height: '7pt', marginRight: mm(0.4), verticalAlign: 'middle' }} />
                Currency: {currency}
              </div>
              <div style={{ fontStyle: 'italic' }}>
                This is a system-generated report.
              </div>
            </div>
          </div>
        </div>
      );
    }

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
