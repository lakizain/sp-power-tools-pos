import React, { useMemo } from 'react';
import { X, Printer, FileText, Calendar } from 'lucide-react';
import { useApp } from '../../context/SupabaseAppContext';

export interface PrintColumn<T = any> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  /** Ignored: column widths are now calculated automatically from the content. */
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
  /**
   * Columns to leave out of the print / PDF (the on-screen table is not affected).
   * Matched against each column's `key` or `header`, ignoring case, spaces and symbols.
   * e.g. ['category', 'barcode', 'createdAt']
   */
  hiddenColumns?: string[];
  reportDateField?: string;
  orientation?: 'portrait' | 'landscape';
  emptyMessage?: string;
}

function mm(n: number): string {
  return `${n.toFixed(3)}mm`;
}

const PX_PER_MM = 3.7795;
const FONT_FAMILY = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

// ---- Layout constants (all in mm) -------------------------------------------------
const LAYOUT = {
  marginX: 10,
  marginY: 10,
  footerReserve: 6, // space kept free at the bottom for "Page x / y"
  compactHeaderH: 10, // header used on page 2, 3, ...
  tableHeaderH: 4.8,
  rowH: 4.0,
  summaryRowH: 4.8,
};

// ---- Visual constants (matches the "Daily Sales Report" sample) -------------------
const COLORS = {
  text: '#222222',
  title: '#333333',
  muted: '#6b6b6b',
  meta: '#444444',
  rule: '#2b2b2b',
  grid: '#d9d9d9',
};
const CELL_BORDER = `0.3mm solid ${COLORS.grid}`;

export function TablePrintModal<T>({
  isOpen,
  onClose,
  title,
  subtitle,
  columns: allColumns,
  data,
  summaries,
  filters,
  hiddenColumns,
  orientation = 'landscape',
  emptyMessage = 'No data to display',
}: TablePrintModalProps<T>) {
  const { state } = useApp();

  const isLandscape = orientation === 'landscape';
  const pageW = isLandscape ? 297 : 210;
  const pageH = isLandscape ? 210 : 297;

  const storeName = (state.settings.storeName || 'Business Report').toUpperCase();
  const currency = state.settings.currency || 'LKR';

  // e.g. "9/21/2026, 10:51:32 AM"
  const generatedAt = useMemo(() => new Date().toLocaleString('en-US'), [isOpen]);

  const hasFilters = !!filters && filters.length > 0;
  const hasSummaries = !!summaries && summaries.length > 0;

  // ---- Columns that should not appear in the printed report -------------------------
  const columns = useMemo(() => {
    if (!hiddenColumns || hiddenColumns.length === 0) return allColumns;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hidden = new Set(hiddenColumns.map(norm));
    return allColumns.filter((c) => !hidden.has(norm(c.key)) && !hidden.has(norm(c.header)));
  }, [allColumns, hiddenColumns]);

  // ---- Column widths: based on the longest content in each column ------------------
  const colWidths = useMemo(() => {
    const weights = columns.map((col) => {
      let max = col.header.length * 1.15;
      for (const row of data) {
        const v = col.accessor(row);
        if (typeof v === 'string' || typeof v === 'number') {
          max = Math.max(max, String(v).length);
        } else if (v !== null && v !== undefined && v !== false) {
          max = Math.max(max, 12);
        }
      }
      return Math.min(Math.max(max, 4), 48) + 3; // +3 ≈ cell padding
    });
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    return weights.map((w) => (w / total) * 100);
  }, [columns, data]);

  // ---- Pagination -------------------------------------------------------------------
  const firstHeaderH =
    6.9 + // store name
    5.5 + // report title
    (subtitle ? 3.6 : 0) +
    (hasFilters ? 4.4 : 0) +
    3.6 + // generated on
    3.4 + // padding + thick rule
    3 + // gap below the header
    2; // safety

  const pages = useMemo(() => {
    const avail = pageH - LAYOUT.marginY * 2 - LAYOUT.footerReserve - LAYOUT.tableHeaderH;
    const cap1 = Math.max(3, Math.floor((avail - firstHeaderH) / LAYOUT.rowH));
    const capN = Math.max(3, Math.floor((avail - LAYOUT.compactHeaderH) / LAYOUT.rowH));

    const out: T[][] = [data.slice(0, cap1)];
    let i = cap1;
    while (i < data.length) {
      out.push(data.slice(i, i + capN));
      i += capN;
    }

    // Make sure the summary rows fit under the last page's table
    if (hasSummaries) {
      const last = out.length - 1;
      const cap = last === 0 ? cap1 : capN;
      const freeH = (cap - out[last].length) * LAYOUT.rowH;
      const summaryH = summaries!.length * LAYOUT.summaryRowH + 3;
      if (freeH < summaryH) out.push([]);
    }
    return out;
  }, [data, pageH, firstHeaderH, hasSummaries, summaries]);

  const totalPages = pages.length;

  // ---- Print ------------------------------------------------------------------------
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

  // ---- Page pieces ------------------------------------------------------------------
  const renderFirstHeader = () => (
    <div
      style={{
        textAlign: 'center',
        paddingBottom: mm(2.5),
        borderBottom: `0.9mm solid ${COLORS.rule}`,
        marginBottom: mm(3),
      }}
    >
      <div
        style={{
          fontSize: '15pt',
          fontWeight: 800,
          color: COLORS.title,
          lineHeight: 1.15,
          marginBottom: mm(0.8),
        }}
      >
        {storeName}
      </div>
      <div
        style={{
          fontSize: '11.5pt',
          fontWeight: 400,
          color: COLORS.muted,
          lineHeight: 1.2,
          marginBottom: mm(0.6),
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: '8pt', color: COLORS.muted, lineHeight: 1.3 }}>{subtitle}</div>
      )}
      {hasFilters && (
        <div
          style={{
            fontSize: '9pt',
            color: COLORS.text,
            lineHeight: 1.3,
            marginBottom: mm(0.6),
          }}
        >
          {filters!.map((f, i) => (
            <span key={i}>
              {i > 0 && <span style={{ margin: `0 ${mm(1.6)}`, color: '#9ca3af' }}>|</span>}
              {f.label}: {f.value}
            </span>
          ))}
        </div>
      )}
      <div style={{ fontSize: '8pt', color: COLORS.meta, lineHeight: 1.3 }}>
        Generated on: {generatedAt}
      </div>
    </div>
  );

  const renderCompactHeader = (pageIndex: number) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingBottom: mm(1.2),
        borderBottom: `0.5mm solid ${COLORS.rule}`,
        marginBottom: mm(2),
        height: mm(LAYOUT.compactHeaderH - 3.2),
        boxSizing: 'content-box',
      }}
    >
      <div style={{ fontSize: '9pt', fontWeight: 800, color: COLORS.title }}>
        {storeName}
        <span style={{ fontWeight: 400, color: COLORS.muted, marginLeft: mm(2) }}>{title}</span>
      </div>
      <div style={{ fontSize: '7pt', color: COLORS.meta }}>
        Page {pageIndex + 1} / {totalPages}
      </div>
    </div>
  );

  const renderTable = (pageData: T[], pageIndex: number) => (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontFamily: FONT_FAMILY,
      }}
    >
      <colgroup>
        {colWidths.map((w, i) => (
          <col key={i} style={{ width: `${w}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th
              key={i}
              style={{
                height: mm(LAYOUT.tableHeaderH),
                textAlign: 'left',
                padding: `0 ${mm(1.2)}`,
                fontSize: '7.4pt',
                fontWeight: 700,
                color: '#111111',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                border: CELL_BORDER,
                background: '#ffffff',
                lineHeight: 1,
              }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pageData.length === 0 && pageIndex === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              style={{
                textAlign: 'center',
                padding: `${mm(8)} 0`,
                color: '#9ca3af',
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
            <tr key={ri}>
              {columns.map((col, ci) => (
                <td
                  key={ci}
                  style={{
                    height: mm(LAYOUT.rowH),
                    textAlign: col.align || 'left',
                    padding: `0 ${mm(1.2)}`,
                    color: COLORS.text,
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '7pt',
                    lineHeight: 1,
                    border: CELL_BORDER,
                  }}
                >
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  // "Total:  Rs. 44500.00" style rows – label on the right, value under the last column
  const renderSummaries = () => {
    const lastColPct = Math.max(colWidths[colWidths.length - 1] ?? 15, 16);
    return (
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: FONT_FAMILY,
          marginTop: '-0.3mm',
        }}
      >
        <colgroup>
          <col />
          <col style={{ width: `${lastColPct}%` }} />
        </colgroup>
        <tbody>
          {summaries!.map((s, i) => (
            <tr key={i} style={{ background: s.highlight ? '#fef3c7' : '#ffffff' }}>
              <td
                style={{
                  height: mm(LAYOUT.summaryRowH),
                  textAlign: 'right',
                  padding: `0 ${mm(1.2)}`,
                  fontSize: '7.6pt',
                  fontWeight: 800,
                  color: '#111111',
                  border: CELL_BORDER,
                  lineHeight: 1,
                }}
              >
                {s.label}:
              </td>
              <td
                style={{
                  height: mm(LAYOUT.summaryRowH),
                  textAlign: 'right',
                  padding: `0 ${mm(1.2)}`,
                  fontSize: '7.6pt',
                  fontWeight: 800,
                  color: '#111111',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  border: CELL_BORDER,
                  lineHeight: 1,
                }}
              >
                {s.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderPages = (preview = false) => {
    const nodes: React.ReactNode[] = [];

    pages.forEach((pageData, p) => {
      const isLast = p === totalPages - 1;
      const showTable = !(pageData.length === 0 && p > 0);

      nodes.push(
        <div
          key={`page-${p}`}
          style={{
            width: mm(pageW),
            height: mm(pageH),
            position: 'relative',
            pageBreakAfter: !isLast ? 'always' : 'auto',
            breakAfter: !isLast ? 'page' : 'auto',
            overflow: 'hidden',
            background: '#ffffff',
            boxSizing: 'border-box',
            margin: 0,
            padding: 0,
            fontFamily: FONT_FAMILY,
            boxShadow: preview ? '0 1px 6px rgba(0,0,0,0.25)' : 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: mm(LAYOUT.marginX),
              right: mm(LAYOUT.marginX),
              top: mm(LAYOUT.marginY),
            }}
          >
            {p === 0 ? renderFirstHeader() : renderCompactHeader(p)}
            {showTable && renderTable(pageData, p)}
            {isLast && hasSummaries && renderSummaries()}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                position: 'absolute',
                left: mm(LAYOUT.marginX),
                right: mm(LAYOUT.marginX),
                bottom: mm(LAYOUT.marginY - 3),
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '6.5pt',
                color: COLORS.muted,
              }}
            >
              <span>Currency: {currency}</span>
              <span>
                Page {p + 1} / {totalPages}
              </span>
            </div>
          )}
        </div>
      );
    });

    return nodes;
  };

  // ---- Preview sizing ---------------------------------------------------------------
  const previewScale = isLandscape ? 0.65 : 0.6;
  const previewGapPx = 16;
  const pagePxW = pageW * PX_PER_MM;
  const pagePxH = pageH * PX_PER_MM;
  const previewInnerH = pagePxH * totalPages + previewGapPx * (totalPages - 1);

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
          {hasFilters && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">Applied Filters</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {filters!.map((f, i) => (
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
              <span className="font-semibold text-gray-900">{totalPages}</span> page
              {totalPages !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <FileText className="h-4 w-4" />
              <span>A4 {orientation} · 96 DPI</span>
            </div>
          </div>

          <div
            className="bg-gray-100 border border-gray-200 rounded-2xl p-4 overflow-auto"
            style={{ maxHeight: '60vh' }}
          >
            <div
              style={{
                width: `${pagePxW * previewScale}px`,
                height: `${previewInnerH * previewScale}px`,
                position: 'relative',
                margin: '0 auto',
              }}
            >
              <div
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                  width: `${pagePxW}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${previewGapPx}px`,
                }}
              >
                {renderPages(true)}
              </div>
            </div>
          </div>
        </div>

        <div id="table-print-sheet" style={{ display: 'none' }}>
          {renderPages(false)}
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
            size: A4 ${orientation};
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