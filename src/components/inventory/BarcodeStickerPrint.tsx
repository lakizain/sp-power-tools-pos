import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { renderBarcodeToSvg } from '../../lib/barcodeUtils';
import { X, Printer } from 'lucide-react';

const STICKER_CONFIG = {
  stickerWidthMm: 42,
  stickerHeightMm: 30,
  mediaWidthMm: 80,
  marginLeftMm: 1.0,
  marginRightMm: 1.0,
  marginTopMm: 0.8,
  marginBottomMm: 0.8,

  companyNameHeightMm: 2.2,
  productNameBaseHeightMm: 2.2,
  productNameMaxLines: 2,
  priceHeightMm: 3.4,
  barcodeNumberHeightMm: 4.2,

  gapMm: 0.3,

  barcodeWidthMm: 38.8,
  barcodeMinHeightMm: 13.5,
  barcodeMaxHeightMm: 15.0,

  companyNameFontSizePt: 6.0,
  productNameFontSizePt: 6.0,
  productNameFontSizeSmallPt: 5.5,
  priceFontSizePt: 9.5,
  barcodeNumberFontSizePt: 10,
} as const;

const A4_GRID_CONFIG = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  columns: 4,
  rows: 8,
  marginXMm: 7,
  marginYMm: 6,
  horizontalGapMm: 9,
  verticalGapMm: 6,
  showBorder: true,
} as const;

type PrintMode = 'thermal' | 'a4grid';

function mm(n: number): string {
  return `${n.toFixed(3)}mm`;
}

function calculateLayout(productNameStr: string) {
  const {
    stickerWidthMm,
    stickerHeightMm,
    marginLeftMm,
    marginRightMm,
    marginTopMm,
    marginBottomMm,
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

  const contentWidthMm = stickerWidthMm - marginLeftMm - marginRightMm;
  const contentHeightMm = stickerHeightMm - marginTopMm - marginBottomMm;

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

  let yCursor = marginTopMm;

  const companyName = {
    x: marginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: companyNameHeightMm,
  };
  yCursor += companyNameHeightMm + gapMm;

  const productName = {
    x: marginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: productNameHeightMm,
    lines: productNameLines,
  };
  yCursor += productNameHeightMm + gapMm;

  const price = {
    x: marginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: priceHeightMm,
  };
  yCursor += priceHeightMm + gapMm;

  const barcodeX = marginLeftMm + (contentWidthMm - barcodeWidthMm) / 2;
  const barcode = {
    x: barcodeX,
    y: yCursor,
    width: barcodeWidthMm,
    height: barcodeHeightMm,
  };
  yCursor += barcodeHeightMm + gapMm;

  const barcodeNumber = {
    x: marginLeftMm,
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
  stickerIndex: number
): { page: number; row: number; col: number; xMm: number; yMm: number } {
  const { columns, rows, marginXMm, marginYMm, horizontalGapMm, verticalGapMm } =
    A4_GRID_CONFIG;
  const { stickerWidthMm, stickerHeightMm } = STICKER_CONFIG;
  const stickersPerPage = columns * rows;

  const page = Math.floor(stickerIndex / stickersPerPage);
  const indexOnPage = stickerIndex % stickersPerPage;
  const row = Math.floor(indexOnPage / columns);
  const col = indexOnPage % columns;

  const xMm = marginXMm + col * (stickerWidthMm + horizontalGapMm);
  const yMm = marginYMm + row * (stickerHeightMm + verticalGapMm);

  return { page, row, col, xMm, yMm };
}

export interface BarcodeStickerPrintProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export function BarcodeStickerPrint({ isOpen, onClose, product }: BarcodeStickerPrintProps) {
  const { state } = useApp();
  const [copies, setCopies] = useState(32);
  const [mode, setMode] = useState<PrintMode>('a4grid');

  const companyName = state.settings.storeName || '';
  const productName = product?.name || '';
  const priceValue = product?.price ?? 0;
  const barcodeValue = product?.barcode || '';
  const currency = state.settings.currency || 'Rs.';

  const layout = useMemo(() => calculateLayout(productName), [productName]);

  const priceFontSize = layout.price.height / 3.6 * STICKER_CONFIG.priceFontSizePt;
  const productNameFontSize = layout.productName.lines >= 2 || productName.length > 22
    ? STICKER_CONFIG.productNameFontSizeSmallPt
    : STICKER_CONFIG.productNameFontSizePt;

  const stickersPerPage = A4_GRID_CONFIG.columns * A4_GRID_CONFIG.rows;
  const totalPages =
    mode === 'a4grid' ? Math.ceil(copies / stickersPerPage) : copies;

  const handlePrint = () => {
    setTimeout(() => {
      const stickerEl = document.getElementById('barcode-sticker-sheet');
      if (!stickerEl) return;

      const clone = stickerEl.cloneNode(true) as HTMLElement;
      clone.id = 'barcode-sticker-print-root';
      clone.style.position = 'absolute';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.zIndex = '999999';
      clone.style.background = '#ffffff';
      clone.style.display = 'block';
      clone.style.visibility = 'visible';

      const bodyChildren = Array.from(document.body.children) as HTMLElement[];
      bodyChildren.forEach((c) => c.classList.add('print-body-hidden'));

      document.body.appendChild(clone);
      clone.classList.add('print-body-visible');
      clone.setAttribute('data-print-mode', mode);

      window.print();

      setTimeout(() => {
        clone.remove();
        bodyChildren.forEach((c) => c.classList.remove('print-body-hidden'));
      }, 300);
    }, 120);
  };

  const formatPrice = (n: number) => {
    return `${currency}. ${n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (!isOpen || !product) return null;

  const {
    stickerWidthMm,
    stickerHeightMm,
    companyName: cn,
    productName: pn,
    price: pr,
    barcode: bc,
    barcodeNumber: bn,
  } = layout;

  const stickerContentProps = {
    companyName,
    productName,
    priceText: formatPrice(priceValue),
    barcodeValue,
    barcodeNumberFontSize: STICKER_CONFIG.barcodeNumberFontSizePt,
    companyNameFontSize: STICKER_CONFIG.companyNameFontSizePt,
    productNameFontSize,
    priceFontSize,
    cn,
    pn,
    pr,
    bc,
    bn,
    showBorder: mode === 'a4grid' && A4_GRID_CONFIG.showBorder,
  };

  const renderThermalSheet = () =>
    Array.from({ length: copies }).map((_, i) => (
      <div
        key={`thermal-${i}`}
        style={{
          width: mm(stickerWidthMm),
          height: mm(stickerHeightMm),
          position: 'relative',
          pageBreakAfter: i < copies - 1 ? 'always' : 'auto',
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        <StickerContent key={`s-${i}`} {...stickerContentProps} stickerKey={`t-${i}`} />
      </div>
    ));

  const renderA4GridSheet = () => {
    const pages: JSX.Element[] = [];
    for (let p = 0; p < totalPages; p++) {
      const startIdx = p * stickersPerPage;
      const endIdx = Math.min(startIdx + stickersPerPage, copies);
      const stickersOnPage: JSX.Element[] = [];

      for (let s = startIdx; s < endIdx; s++) {
        const { xMm, yMm } = getGridPosition(s);
        stickersOnPage.push(
          <div
            key={`sticker-${s}`}
            style={{
              position: 'absolute',
              left: mm(xMm),
              top: mm(yMm),
              width: mm(stickerWidthMm),
              height: mm(stickerHeightMm),
              overflow: 'hidden',
              background: '#ffffff',
              border: A4_GRID_CONFIG.showBorder ? '0.2mm solid #d1d5db' : 'none',
              boxSizing: 'border-box',
            }}
          >
            <StickerContent {...stickerContentProps} stickerKey={`a4-${s}`} showBorder={false} />
          </div>
        );
      }

      pages.push(
        <div
          key={`page-${p}`}
          style={{
            width: mm(A4_GRID_CONFIG.pageWidthMm),
            height: mm(A4_GRID_CONFIG.pageHeightMm),
            position: 'relative',
            pageBreakAfter: p < totalPages - 1 ? 'always' : 'auto',
            overflow: 'hidden',
            background: '#ffffff',
            boxSizing: 'border-box',
          }}
        >
          {stickersOnPage}
        </div>
      );
    }
    return pages;
  };

  const renderPreview = () => {
    if (mode === 'thermal') {
      return (
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
          <StickerContent {...stickerContentProps} stickerKey="pv-thermal" />
        </div>
      );
    }

    const previewScale = 2.2;
    const pageW = A4_GRID_CONFIG.pageWidthMm * previewScale;
    const pageH = A4_GRID_CONFIG.pageHeightMm * previewScale;
    const firstPageStickers = Math.min(copies, stickersPerPage);
    const previewStickers: JSX.Element[] = [];

    for (let s = 0; s < firstPageStickers; s++) {
      const { xMm, yMm } = getGridPosition(s);
      previewStickers.push(
        <div
          key={`pv-${s}`}
          style={{
            position: 'absolute',
            left: `${xMm * previewScale}px`,
            top: `${yMm * previewScale}px`,
            width: `${stickerWidthMm * previewScale}px`,
            height: `${stickerHeightMm * previewScale}px`,
            border: A4_GRID_CONFIG.showBorder ? '0.5px solid #d1d5db' : '1px dashed #9ca3af',
            background: '#ffffff',
            boxSizing: 'border-box',
            transform: `scale(1)`,
            transformOrigin: 'top left',
          }}
        >
          <div style={{ transform: `scale(${previewScale / 3.7795275591})`, transformOrigin: 'top left', width: `${stickerWidthMm * 3.7795275591}px`, height: `${stickerHeightMm * 3.7795275591}px`, position: 'relative' }}>
            <StickerContent {...stickerContentProps} stickerKey={`pv-s-${s}`} showBorder={false} />
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          width: `${pageW}px`,
          height: `${pageH}px`,
          position: 'relative',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          flexShrink: 0,
        }}
      >
        {previewStickers}
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-3xl">
        <div className="modal-header no-print">
          <h2 className="text-xl font-bold text-gray-900">Print Barcode Sticker</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="modal-body space-y-6">
          <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Sticker Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Product:</span>
                  <span className="font-medium text-gray-900">{productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SKU:</span>
                  <span className="font-mono text-gray-900">{product.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Barcode:</span>
                  <span className="font-mono text-gray-900">{barcodeValue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Price:</span>
                  <span className="font-semibold text-gray-900">{formatPrice(priceValue)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Print Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode('thermal')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition ${
                      mode === 'thermal'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    🖨️ Thermal Roll
                    <div className="text-xs font-normal mt-0.5 opacity-80">
                      38×25mm · Xprinter
                    </div>
                  </button>
                  <button
                    onClick={() => setMode('a4grid')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition ${
                      mode === 'a4grid'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    📄 A4 Sheet Grid
                    <div className="text-xs font-normal mt-0.5 opacity-80">
                      4×8 = {stickersPerPage}/page
                    </div>
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                {mode === 'thermal'
                  ? `Sticker: ${stickerWidthMm}×${stickerHeightMm}mm · Left-aligned on 80mm media`
                  : `A4 (${A4_GRID_CONFIG.pageWidthMm}×${A4_GRID_CONFIG.pageHeightMm}mm) · Grid: ${A4_GRID_CONFIG.columns}×${A4_GRID_CONFIG.rows} = ${stickersPerPage} stickers/page · Gaps: ${A4_GRID_CONFIG.horizontalGapMm}/${A4_GRID_CONFIG.verticalGapMm}mm`}
                {mode === 'a4grid' && copies > 0 && (
                  <span className="ml-2 font-medium">
                    · Pages: {totalPages}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="no-print">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Preview</h3>
            <div className="flex justify-center p-6 bg-gray-100 rounded-2xl border border-gray-200 overflow-auto">
              {renderPreview()}
            </div>
          </div>
        </div>

        <div id="barcode-sticker-sheet" style={{ display: 'none' }}>
          {mode === 'thermal' ? renderThermalSheet() : renderA4GridSheet()}
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
            Print {copies > 1 ? `${copies} Stickers` : 'Sticker'}
            {mode === 'a4grid' && totalPages > 1 && ` · ${totalPages} Pages`}
          </button>
        </div>

        <style>{`
          @media print {
            @page {
              margin: 0mm;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
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

            #barcode-sticker-print-root,
            #barcode-sticker-print-root * {
              visibility: visible !important;
              display: block !important;
            }

            #barcode-sticker-print-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            #barcode-sticker-print-root > div {
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
            }

            #barcode-sticker-print-root[data-print-mode="thermal"] {
              width: ${STICKER_CONFIG.stickerWidthMm}mm !important;
            }

            #barcode-sticker-print-root[data-print-mode="thermal"] @page {
              size: ${STICKER_CONFIG.stickerWidthMm}mm ${STICKER_CONFIG.stickerHeightMm}mm;
            }

            #barcode-sticker-print-root[data-print-mode="a4grid"] {
              width: ${A4_GRID_CONFIG.pageWidthMm}mm !important;
            }

            #barcode-sticker-print-root[data-print-mode="a4grid"] @page {
              size: A4 portrait;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

interface StickerContentProps {
  companyName: string;
  productName: string;
  priceText: string;
  barcodeValue: string;
  companyNameFontSize: number;
  productNameFontSize: number;
  priceFontSize: number;
  barcodeNumberFontSize: number;
  cn: { x: number; y: number; width: number; height: number };
  pn: { x: number; y: number; width: number; height: number; lines: number };
  pr: { x: number; y: number; width: number; height: number };
  bc: { x: number; y: number; width: number; height: number };
  bn: { x: number; y: number; width: number; height: number };
  stickerKey: string;
  showBorder?: boolean;
}

function StickerContent({
  companyName,
  productName,
  priceText,
  barcodeValue,
  companyNameFontSize,
  productNameFontSize,
  priceFontSize,
  barcodeNumberFontSize,
  cn,
  pn,
  pr,
  bc,
  bn,
  stickerKey,
  showBorder = false,
}: StickerContentProps) {
  const inlineBarcodeSvgRef = useRef<SVGSVGElement>(null);
  const key = `${stickerKey}-${barcodeValue}-${bc.width}-${bc.height}`;

  useEffect(() => {
    if (!inlineBarcodeSvgRef.current || !barcodeValue) return;
    const svg = inlineBarcodeSvgRef.current;
    const widthPx = (bc.width / 25.4) * 96;
    const heightPx = (bc.height / 25.4) * 96;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = '';
    try {
      renderBarcodeToSvg(svg, barcodeValue, {
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
  }, [key, barcodeValue, bc.width, bc.height]);

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
        border: showBorder ? '0.1mm solid #9ca3af' : 'none',
        boxSizing: 'border-box',
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
        {companyName}
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
        {productName}
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
        {priceText}
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
          ref={inlineBarcodeSvgRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
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
        {barcodeValue}
      </div>
    </div>
  );
}
