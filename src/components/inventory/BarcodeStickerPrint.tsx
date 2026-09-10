import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { renderBarcodeToSvg } from '../../lib/barcodeUtils';
import { X, Printer, Minus, Plus, FileText } from 'lucide-react';

const PAGE_CONFIG = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  columns: 4,
  rows: 8,
  stickersPerPage: 32,

  leftMarginMm: 5.0,
  topMarginMm: 20.5,

  stickerWidthMm: 38,
  stickerHeightMm: 25,

  horizontalPitchMm: 54.0,
  verticalPitchMm: 32.7,
} as const;

const STICKER_CONFIG = {
  contentMarginLeftMm: 1.0,
  contentMarginRightMm: 1.0,
  contentMarginTopMm: 0.8,
  contentMarginBottomMm: 0.8,

  companyNameHeightMm: 2.0,
  productNameBaseHeightMm: 2.0,
  productNameMaxLines: 2,
  priceHeightMm: 3.0,
  barcodeNumberHeightMm: 3.8,

  gapMm: 0.3,

  barcodeWidthMm: 34.8,
  barcodeMinHeightMm: 8.5,
  barcodeMaxHeightMm: 10,

  companyNameFontSizePt: 5.5,
  productNameFontSizePt: 5.5,
  productNameFontSizeSmallPt: 5.0,
  priceFontSizePt: 8.5,
  barcodeNumberFontSizePt: 9,
} as const;

interface StickerData {
  companyName: string;
  productName: string;
  priceText: string;
  barcodeValue: string;
}

function mm(n: number): string {
  return `${n.toFixed(3)}mm`;
}

function calculateStickerLayout(productNameStr: string) {
  const {
    stickerWidthMm,
    stickerHeightMm,
    contentMarginLeftMm,
    contentMarginRightMm,
    contentMarginTopMm,
    contentMarginBottomMm,
    companyNameHeightMm,
    productNameBaseHeightMm,
    productNameMaxLines,
    priceHeightMm,
    barcodeNumberHeightMm,
    gapMm,
    barcodeWidthMm,
    barcodeMinHeightMm,
    barcodeMaxHeightMm,
  } = STICKER_CONFIG;

  const contentWidthMm = stickerWidthMm - contentMarginLeftMm - contentMarginRightMm;
  const contentHeightMm = stickerHeightMm - contentMarginTopMm - contentMarginBottomMm;

  const nameLength = productNameStr.length;
  let productNameLines = 1;
  if (nameLength > 20) productNameLines = 2;
  productNameLines = Math.min(productNameLines, productNameMaxLines);

  const productNameHeightMm = productNameBaseHeightMm * productNameLines;
  const fixedGaps = gapMm * 4;

  const fixedElementsHeightMm =
    companyNameHeightMm +
    productNameHeightMm +
    priceHeightMm +
    barcodeNumberHeightMm +
    fixedGaps;

  let barcodeHeightMm = contentHeightMm - fixedElementsHeightMm;
  barcodeHeightMm = Math.max(barcodeHeightMm, barcodeMinHeightMm);
  barcodeHeightMm = Math.min(barcodeHeightMm, barcodeMaxHeightMm);

  let yCursor = contentMarginTopMm;

  const companyName = {
    x: contentMarginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: companyNameHeightMm,
  };
  yCursor += companyNameHeightMm + gapMm;

  const productName = {
    x: contentMarginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: productNameHeightMm,
    lines: productNameLines,
  };
  yCursor += productNameHeightMm + gapMm;

  const price = {
    x: contentMarginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: priceHeightMm,
  };
  yCursor += priceHeightMm + gapMm;

  const barcodeX = contentMarginLeftMm + (contentWidthMm - barcodeWidthMm) / 2;
  const barcode = {
    x: barcodeX,
    y: yCursor,
    width: barcodeWidthMm,
    height: barcodeHeightMm,
  };
  yCursor += barcodeHeightMm + gapMm;

  const barcodeNumber = {
    x: contentMarginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: barcodeNumberHeightMm,
  };

  return {
    stickerWidthMm,
    stickerHeightMm,
    contentWidthMm,
    contentHeightMm,
    companyName,
    productName,
    price,
    barcode,
    barcodeNumber,
  };
}

function getGridPosition(
  stickerIndex: number,
): { pageIndex: number; column: number; row: number; xMm: number; yMm: number } {
  const { stickersPerPage, columns, rows, leftMarginMm, topMarginMm, horizontalPitchMm, verticalPitchMm } =
    PAGE_CONFIG;

  const pageIndex = Math.floor(stickerIndex / stickersPerPage);
  const indexInPage = stickerIndex % stickersPerPage;

  const column = Math.floor(indexInPage / rows);
  const row = indexInPage % rows;

  const xMm = leftMarginMm + column * horizontalPitchMm;
  const yMm = topMarginMm + row * verticalPitchMm;

  return { pageIndex, column, row, xMm, yMm };
}

export interface BarcodeStickerPrintProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export function BarcodeStickerPrint({ isOpen, onClose, product }: BarcodeStickerPrintProps) {
  const { state } = useApp();
  const [copies, setCopies] = useState(32);

  const companyName = state.settings.storeName || '';
  const productName = product?.name || '';
  const priceValue = product?.price ?? 0;
  const barcodeValue = product?.barcode || '';
  const currency = state.settings.currency || 'Rs.';

  const layout = calculateStickerLayout(productName);

  const priceFontSize = (layout.price.height / 3.0) * STICKER_CONFIG.priceFontSizePt;
  const productNameFontSize =
    layout.productName.lines >= 2 || productName.length > 22
      ? STICKER_CONFIG.productNameFontSizeSmallPt
      : STICKER_CONFIG.productNameFontSizePt;

  const stickerData: StickerData = {
    companyName,
    productName,
    priceText: formatPriceStatic(priceValue, currency),
    barcodeValue,
  };

  const pages = useMemo(() => {
    const { stickersPerPage } = PAGE_CONFIG;
    const pageCount = Math.max(1, Math.ceil(copies / stickersPerPage));
    const result: StickerData[][][] = [];

    for (let p = 0; p < pageCount; p++) {
      const rowsArr: StickerData[][] = [];
      for (let r = 0; r < PAGE_CONFIG.rows; r++) {
        const rowCells: StickerData[] = [];
        for (let c = 0; c < PAGE_CONFIG.columns; c++) {
          const globalIndex = p * stickersPerPage + c * PAGE_CONFIG.rows + r;
          if (globalIndex < copies && barcodeValue) {
            rowCells.push(stickerData);
          } else {
            rowCells.push(null as unknown as StickerData);
          }
        }
        rowsArr.push(rowCells);
      }
      result.push(rowsArr);
    }
    return result;
  }, [copies, barcodeValue, stickerData]);

  const handlePrint = () => {
    setTimeout(() => {
      const sheetRoot = document.getElementById('barcode-sticker-sheet');
      if (!sheetRoot) return;

      const clone = sheetRoot.cloneNode(true) as HTMLElement;
      clone.id = 'barcode-sticker-print-root';
      clone.style.position = 'absolute';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.zIndex = '999999';
      clone.style.background = '#ffffff';
      clone.style.display = 'block';
      clone.style.visibility = 'visible';
      clone.style.width = mm(PAGE_CONFIG.pageWidthMm);

      const bodyChildren = Array.from(document.body.children) as HTMLElement[];
      bodyChildren.forEach((c) => c.classList.add('print-body-hidden'));

      document.body.appendChild(clone);
      clone.classList.add('print-body-visible');

      window.print();

      setTimeout(() => {
        clone.remove();
        bodyChildren.forEach((c) => c.classList.remove('print-body-hidden'));
      }, 300);
    }, 200);
  };

  if (!isOpen || !product) return null;

  const { stickerWidthMm, stickerHeightMm, companyName: cn, productName: pn, price: pr, barcode: bc, barcodeNumber: bn } =
    layout;

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl">
        <div className="modal-header no-print">
          <h2 className="text-xl font-bold text-gray-900">Print Barcode Stickers</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="modal-body space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Product</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="font-medium text-gray-900 text-right max-w-[55%] truncate">
                    {productName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SKU:</span>
                  <span className="font-mono text-gray-900">{product.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Barcode:</span>
                  <span className="font-mono text-gray-900">{barcodeValue || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Price:</span>
                  <span className="font-semibold text-gray-900">{stickerData.priceText}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Page Layout</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Format:</span>
                  <span className="font-medium text-gray-900">A4 (210 × 297 mm)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Grid:</span>
                  <span className="font-medium text-gray-900">
                    {PAGE_CONFIG.columns} × {PAGE_CONFIG.rows} = {PAGE_CONFIG.stickersPerPage} / page
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sticker:</span>
                  <span className="font-medium text-gray-900">
                    {stickerWidthMm} × {stickerHeightMm} mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pitch (H×V):</span>
                  <span className="font-medium text-gray-900">
                    {PAGE_CONFIG.horizontalPitchMm} × {PAGE_CONFIG.verticalPitchMm} mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Order:</span>
                  <span className="badge badge-info">Column-first (↓ then →)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="no-print">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Stickers</label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setCopies((c) => Math.max(1, c - 1))}
                className="btn btn-secondary btn-md"
                disabled={copies <= 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-2xl font-bold text-gray-900 w-20 text-center tabular-nums">
                {copies}
              </span>
              <button
                onClick={() => setCopies((c) => Math.min(320, c + 1))}
                className="btn btn-secondary btn-md"
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="flex flex-wrap gap-2 ml-2">
                {[8, 16, 32, 64].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCopies(n)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                      copies === n
                        ? 'bg-primary-500 text-white shadow-medium'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              {pages.length} {pages.length === 1 ? 'page' : 'pages'} • fills columns top → bottom then left → right
            </p>
          </div>

          <div className="no-print">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Single Sticker Preview</h3>
            <div className="flex justify-center p-6 bg-gray-100 rounded-2xl border border-gray-200">
              <div
                style={{
                  width: `${stickerWidthMm * 3.7795275591}px`,
                  height: `${stickerHeightMm * 3.7795275591}px`,
                  border: '1px dashed #9ca3af',
                  position: 'relative',
                  background: '#ffffff',
                  flexShrink: 0,
                }}
              >
                {barcodeValue ? (
                  <StickerContent
                    data={stickerData}
                    companyNameFontSize={STICKER_CONFIG.companyNameFontSizePt}
                    productNameFontSize={productNameFontSize}
                    priceFontSize={priceFontSize}
                    barcodeNumberFontSize={STICKER_CONFIG.barcodeNumberFontSizePt}
                    cn={cn}
                    pn={pn}
                    pr={pr}
                    bc={bc}
                    bn={bn}
                    instanceKey="preview"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500 text-center p-4">
                    No barcode. Edit the product to generate a barcode first.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div id="barcode-sticker-sheet" style={{ display: 'none' }}>
          {pages.map((pageRows, pageIdx) => (
            <A4Page key={`page-${pageIdx}`} isLast={pageIdx === pages.length - 1}>
              {pageRows.map((rowCells, rIdx) =>
                rowCells.map((cell, cIdx) => {
                  if (!cell || !cell.barcodeValue) return null;
                  const { xMm, yMm } = getGridPosition(
                    pageIdx * PAGE_CONFIG.stickersPerPage + cIdx * PAGE_CONFIG.rows + rIdx,
                  );
                  return (
                    <div
                      key={`p${pageIdx}-r${rIdx}-c${cIdx}`}
                      style={{
                        position: 'absolute',
                        left: mm(xMm),
                        top: mm(yMm),
                        width: mm(stickerWidthMm),
                        height: mm(stickerHeightMm),
                        overflow: 'hidden',
                        background: '#ffffff',
                      }}
                    >
                      <StickerContent
                        data={cell}
                        companyNameFontSize={STICKER_CONFIG.companyNameFontSizePt}
                        productNameFontSize={productNameFontSize}
                        priceFontSize={priceFontSize}
                        barcodeNumberFontSize={STICKER_CONFIG.barcodeNumberFontSizePt}
                        cn={cn}
                        pn={pn}
                        pr={pr}
                        bc={bc}
                        bn={bn}
                        instanceKey={`p${pageIdx}-r${rIdx}-c${cIdx}-${cell.barcodeValue}`}
                      />
                    </div>
                  );
                }),
              )}
            </A4Page>
          ))}
        </div>

        <div className="modal-footer no-print">
          <button onClick={onClose} className="btn btn-secondary btn-md">
            Close
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-primary btn-md"
            disabled={!barcodeValue}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print {copies} Sticker{copies === 1 ? '' : 's'}
          </button>
        </div>

        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 0mm;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: ${PAGE_CONFIG.pageWidthMm}mm !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            body {
              height: auto !important;
            }

            .no-print { display: none !important; }
            .print-body-hidden { display: none !important; }
            .print-body-visible {
              display: block !important;
              visibility: visible !important;
            }

            #barcode-sticker-print-root,
            #barcode-sticker-print-root * {
              visibility: visible !important;
            }

            #barcode-sticker-print-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: ${PAGE_CONFIG.pageWidthMm}mm !important;
            }

            .a4-page {
              width: ${PAGE_CONFIG.pageWidthMm}mm !important;
              height: ${PAGE_CONFIG.pageHeightMm}mm !important;
              position: relative !important;
              overflow: hidden !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }

            .a4-page:last-of-type {
              page-break-after: auto !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

function formatPriceStatic(n: number, currency: string): string {
  return `${currency}. ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function A4Page({ children, isLast }: { children: React.ReactNode; isLast?: boolean }) {
  return (
    <div
      className="a4-page"
      style={{
        width: mm(PAGE_CONFIG.pageWidthMm),
        height: mm(PAGE_CONFIG.pageHeightMm),
        position: 'relative',
        overflow: 'hidden',
        background: '#ffffff',
        pageBreakAfter: isLast ? 'auto' : 'always',
      }}
    >
      {children}
    </div>
  );
}

interface StickerContentProps {
  data: StickerData;
  companyNameFontSize: number;
  productNameFontSize: number;
  priceFontSize: number;
  barcodeNumberFontSize: number;
  cn: { x: number; y: number; width: number; height: number };
  pn: { x: number; y: number; width: number; height: number; lines: number };
  pr: { x: number; y: number; width: number; height: number };
  bc: { x: number; y: number; width: number; height: number };
  bn: { x: number; y: number; width: number; height: number };
  instanceKey: string;
}

function StickerContent({
  data,
  companyNameFontSize,
  productNameFontSize,
  priceFontSize,
  barcodeNumberFontSize,
  cn,
  pn,
  pr,
  bc,
  bn,
  instanceKey,
}: StickerContentProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const depKey = `${instanceKey}-${data.barcodeValue}-${bc.width}-${bc.height}`;

  useEffect(() => {
    if (!svgRef.current || !data.barcodeValue) return;
    const svg = svgRef.current;
    const widthPx = (bc.width / 25.4) * 96;
    const heightPx = (bc.height / 25.4) * 96;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = '';
    try {
      renderBarcodeToSvg(svg, data.barcodeValue, {
        format: 'CODE128',
        width: Math.max(1, Math.floor(widthPx / 60)),
        height: heightPx,
        displayValue: false,
        margin: 0,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (e) {
      console.error(e);
    }
  }, [depKey, data.barcodeValue, bc.width, bc.height]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#ffffff',
        fontFamily: "'Inter', Arial, Helvetica, sans-serif",
        color: '#000000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: mm(cn.x),
          top: mm(cn.y),
          width: mm(cn.width),
          height: mm(cn.height),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: `${companyNameFontSize}pt`,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '0.02em',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {data.companyName}
      </div>

      <div
        style={{
          position: 'absolute',
          left: mm(pn.x),
          top: mm(pn.y),
          width: mm(pn.width),
          height: mm(pn.height),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: `${productNameFontSize}pt`,
          fontWeight: 600,
          lineHeight: 1.15,
          overflow: 'hidden',
          wordBreak: 'break-word',
          hyphens: 'auto',
        }}
      >
        {data.productName}
      </div>

      <div
        style={{
          position: 'absolute',
          left: mm(pr.x),
          top: mm(pr.y),
          width: mm(pr.width),
          height: mm(pr.height),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: `${priceFontSize}pt`,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '0.01em',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {data.priceText}
      </div>

      <div
        style={{
          position: 'absolute',
          left: mm(bc.x),
          top: mm(bc.y),
          width: mm(bc.width),
          height: mm(bc.height),
          background: '#ffffff',
        }}
      >
        <svg
          ref={svgRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: mm(bn.x),
          top: mm(bn.y),
          width: mm(bn.width),
          height: mm(bn.height),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: `${barcodeNumberFontSize}pt`,
          fontWeight: 600,
          lineHeight: 1,
          fontFamily: "'Courier New', monospace",
          letterSpacing: '0.08em',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {data.barcodeValue}
      </div>
    </div>
  );
}
