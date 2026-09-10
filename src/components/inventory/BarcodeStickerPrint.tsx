import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Plus, Minus } from 'lucide-react';
import { Product } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { renderBarcodeToSvg } from '../../lib/barcodeUtils';

interface BarcodeStickerPrintProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

type LayoutMode = 'letter-sheet' | 'roll-35x25';

const SHEET_PAGE_W_MM = 215.9;
const SHEET_PAGE_H_MM = 279.4;
const SHEET_COLS = 4;
const SHEET_ROWS_PER_PAGE = 7;
const SHEET_STICKERS_PER_PAGE = SHEET_COLS * SHEET_ROWS_PER_PAGE;
const SHEET_COL_PITCH_MM = 54.0;
const SHEET_ROW_PITCH_MM = 32.7;
const SHEET_FIRST_COL_LEFT_MM = 5;
const SHEET_FIRST_ROW_TOP_MM = 20.5;
const SHEET_BLOCK_W_MM = 34.8;

const SHEET_COL_LEFT_MM = Array.from({ length: SHEET_COLS }, (_, c) => SHEET_FIRST_COL_LEFT_MM + c * SHEET_COL_PITCH_MM);
const SHEET_ROW_TOP_MM = Array.from({ length: SHEET_ROWS_PER_PAGE }, (_, r) => SHEET_FIRST_ROW_TOP_MM + r * SHEET_ROW_PITCH_MM);

const ROLL_STICKER_W_MM = 35;
const ROLL_STICKER_H_MM = 25;
const ROLL_BLOCK_W_MM = 33;
const ROLL_BLOCK_H_MM = 23;

const PREVIEW_W_SHEET = 96;
const PREVIEW_H_SHEET = 147;
const PREVIEW_W_ROLL = 126;
const PREVIEW_H_ROLL = 90;

const LAYOUT_OPTIONS: { value: LayoutMode; label: string; description: string }[] = [
  {
    value: 'letter-sheet',
    label: 'A4 / Letter Sheet',
    description: '215.9mm × 279.4mm · 4 cols × 7 rows (28 per page)',
  },
  {
    value: 'roll-35x25',
    label: 'Xprinter Roll 35×25mm',
    description: '35mm × 25mm · Sticker Roll (XP-365B)',
  },
];

export function BarcodeStickerPrint({ isOpen, onClose, product }: BarcodeStickerPrintProps) {
  const { state } = useApp();
  const [stickerCount, setStickerCount] = useState(1);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('roll-35x25');
  const previewSvgs = useRef<Map<number, SVGSVGElement>>(new Map());
  const printSvgs = useRef<Map<number, SVGSVGElement>>(new Map());

  const renderBarcodes = (
    refMap: React.MutableRefObject<Map<number, SVGSVGElement>>,
    height: number,
    fontSize: number,
    barWidth: number,
    displayValue: boolean = true,
    marginTop: number = 0,
    marginBottom: number = 2,
  ) => {
    if (!product?.barcode) return;
    refMap.current.forEach((svg) => {
      if (svg) {
        while (svg.firstChild) {
          svg.removeChild(svg.firstChild);
        }
        renderBarcodeToSvg(svg, product.barcode!, {
          height,
          fontSize,
          width: barWidth,
          margin: 0,
          marginTop,
          marginBottom,
          displayValue,
          font: 'Arial, monospace',
          textAlign: 'center',
        });
      }
    });
  };

  useEffect(() => {
    if (!isOpen || !product) return;
    const isRollMode = layoutMode === 'roll-35x25';
    const h = isRollMode ? 38 : 56;
    const fs = isRollMode ? 9 : 12;
    const bw = isRollMode ? 2.5 : 2.5;
    renderBarcodes(previewSvgs, h, fs, bw, true, 0, 3);
  }, [isOpen, product?.id, product?.barcode, stickerCount, layoutMode]);

  if (!isOpen || !product) return null;

  const handlePrint = () => {
    if (layoutMode === 'roll-35x25') {
      renderBarcodes(printSvgs, 44, 11, 2.5, true, 0, 4);
    } else {
      renderBarcodes(printSvgs, 72, 14, 2.5, true, 0, 4);
    }

    setTimeout(() => {
      const src = document.getElementById('sticker-print-area');
      if (!src) return;

      const clone = src.cloneNode(true) as HTMLElement;
      clone.id = 'sticker-print-area-clone';
      clone.style.cssText = 'display:block;position:absolute;left:0;top:0;width:100%;padding:0;z-index:99999;background:#fff';

      const origSvgs = src.querySelectorAll('svg');
      clone.querySelectorAll('svg').forEach((c, i) => {
        const t = c as SVGSVGElement;
        const s = origSvgs[i] as SVGSVGElement;
        if (t && s) {
          const vb = s.getAttribute('viewBox');
          if (vb) t.setAttribute('viewBox', vb);
          const w = s.getAttribute('width');
          if (w) t.setAttribute('width', w);
          const h = s.getAttribute('height');
          if (h) t.setAttribute('height', h);
          while (t.firstChild) t.removeChild(t.firstChild);
          Array.from(s.childNodes).forEach((n) => t.appendChild(n.cloneNode(true)));
        }
      });

      const children = Array.from(document.body.children) as HTMLElement[];
      children.forEach((el) => el.classList.add('print-body-hidden'));
      document.body.appendChild(clone);
      clone.classList.add('print-body-visible');

      window.print();

      setTimeout(() => {
        clone.remove();
        children.forEach((el) => el.classList.remove('print-body-hidden'));
      }, 300);
    }, 500);
  };

  const setPreviewRef = (i: number) => (el: SVGSVGElement | null) => {
    if (el) previewSvgs.current.set(i, el);
  };

  const setPrintRef = (i: number) => (el: SVGSVGElement | null) => {
    if (el) printSvgs.current.set(i, el);
  };

  const priceText = product.isWeightBased
    ? `${state.settings.currency}${(product.pricePerUnit || 0).toFixed(2)}/${product.unit || 'kg'}`
    : `${state.settings.currency}${product.price.toFixed(2)}`;

  const isRoll = layoutMode === 'roll-35x25';
  const blockWmm = isRoll ? ROLL_BLOCK_W_MM : SHEET_BLOCK_W_MM;
  const previewW = isRoll ? PREVIEW_W_ROLL : PREVIEW_W_SHEET;
  const previewH = isRoll ? PREVIEW_H_ROLL : PREVIEW_H_SHEET;

  const StickerContent = ({
    svgRef,
    isPrint,
  }: {
    svgRef: (el: SVGSVGElement | null) => void;
    isPrint: boolean;
  }) => {
    if (isRoll) {
      return (
        <div
          className="flex flex-col items-start justify-between bg-white text-black"
          style={{
            width: isPrint ? `${blockWmm}mm` : `${previewW}px`,
            height: isPrint ? `${ROLL_BLOCK_H_MM}mm` : `${previewH}px`,
            padding: isPrint ? '0.3mm 0mm 0.3mm 0mm' : '0.5px 0px 0.5px 0px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            fontFamily: 'Arial, sans-serif',
            gap: isPrint ? '0.2mm' : '0.5px',
          }}
        >
          <div
            className="text-center font-bold uppercase w-full truncate tracking-tighter"
            style={{
              fontSize: isPrint ? '5pt' : '5.5px',
              letterSpacing: isPrint ? '-0.05mm' : '-0.1px',
              lineHeight: 1,
            }}
          >
            S&amp;P POWER TOOLS
          </div>

          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            style={{
              width: '100%',
              height: isPrint ? 'auto' : '52px',
              display: 'block',
              flex: 1,
            }}
          />

          <div
            className="text-center font-semibold leading-none w-full"
            style={{
              fontSize: isPrint ? '5.5pt' : '6.5px',
              lineHeight: 1,
            }}
          >
            {priceText}
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex flex-col items-center justify-between bg-white text-black"
        style={{
          width: isPrint ? `${blockWmm}mm` : `${previewW}px`,
          height: isPrint ? 'auto' : `${previewH}px`,
          padding: isPrint ? '0.2mm 0 0.2mm 0' : '1px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          fontFamily: 'Arial, sans-serif',
          gap: isPrint ? '0.4mm' : '1px',
        }}
      >
        <div
          className="text-center font-bold uppercase w-full truncate tracking-tighter"
          style={{
            fontSize: isPrint ? '6pt' : '6px',
            letterSpacing: isPrint ? '-0.05mm' : '-0.08px',
            lineHeight: 1.05,
          }}
        >
          S&amp;P POWER TOOLS
        </div>

        <div
          className="text-center font-semibold leading-tight w-full overflow-hidden"
          style={{
            fontSize: isPrint ? '7pt' : '7px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineClamp: 2,
            lineHeight: 1.05,
          }}
        >
          {product.name}
        </div>

        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: '100%',
            height: isPrint ? 'auto' : '56px',
            display: 'block',
          }}
        />

        <div
          className="text-center font-bold leading-none w-full"
          style={{
            fontSize: isPrint ? '7.5pt' : '8px',
            lineHeight: 1,
          }}
        >
          {priceText}
        </div>
      </div>
    );
  };

  const pageSizeW = isRoll ? ROLL_STICKER_W_MM : SHEET_PAGE_W_MM;
  const pageSizeH = isRoll ? ROLL_STICKER_H_MM : SHEET_PAGE_H_MM;

  const totalPages: number = isRoll
    ? stickerCount
    : Math.max(1, Math.ceil(stickerCount / SHEET_STICKERS_PER_PAGE));

  return (
    <div className="modal-overlay">
      <div className="modal max-w-4xl">
        <div className="modal-header no-print">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Print Barcode Stickers</h2>
            <p className="text-sm text-gray-600 mt-1">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="modal-body no-print space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Layout / Paper</label>
              <div className="space-y-2">
                {LAYOUT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLayoutMode(opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-all ${
                      layoutMode === opt.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Stickers</label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setStickerCount(Math.max(1, stickerCount - 1))}
                    className="btn btn-secondary btn-sm p-2"
                    disabled={stickerCount <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={stickerCount}
                    onChange={(e) =>
                      setStickerCount(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))
                    }
                    className="input text-center flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setStickerCount(Math.min(1000, stickerCount + 1))}
                    className="btn btn-secondary btn-sm p-2"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="card p-3 bg-gray-50 w-full">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Barcode:</span>
                    <span className="font-mono font-semibold text-gray-700">
                      {product.barcode || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>SKU:</span>
                    <span className="font-mono text-gray-700">{product.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price:</span>
                    <span className="font-semibold text-gray-800">{priceText}</span>
                  </div>
                  <div className="flex justify-between pt-1 mt-1 border-t border-gray-200">
                    <span>Pages:</span>
                    <span className="font-semibold text-gray-800">{totalPages}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Preview ({stickerCount} sticker{stickerCount > 1 ? 's' : ''})
            </h3>
            <div className="bg-gray-100 rounded-xl p-6 max-h-[450px] overflow-y-auto">
              <div
                className="grid gap-4 justify-center"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${previewW + 20}px, 1fr)`,
                }}
              >
                {Array.from({ length: Math.min(stickerCount, 30) }, (_, i) => (
                  <div
                    key={i}
                    className="border border-gray-300 shadow-md mx-auto"
                    style={{ width: `${previewW}px`, height: `${previewH}px` }}
                  >
                    <StickerContent svgRef={setPreviewRef(i)} isPrint={false} />
                  </div>
                ))}
                {stickerCount > 30 && (
                  <div className="flex items-center justify-center col-span-full py-4 text-sm text-gray-500">
                    ... +{stickerCount - 30} more stickers (will all print)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div id="sticker-print-area" className="hidden print:block">
          {Array.from({ length: totalPages }, (_, pageIdx) => {
            if (isRoll) {
              const stickerIdx = pageIdx;
              return (
                <div
                  key={`roll-page-${pageIdx}`}
                  style={{
                    position: 'relative',
                    width: `${ROLL_STICKER_W_MM}mm`,
                    height: `${ROLL_STICKER_H_MM}mm`,
                    margin: 0,
                    padding: 0,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    pageBreakAfter: pageIdx < totalPages - 1 ? 'always' : 'auto',
                    pageBreakInside: 'avoid',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StickerContent svgRef={setPrintRef(stickerIdx)} isPrint={true} />
                </div>
              );
            }

            return (
              <div
                key={`sheet-page-${pageIdx}`}
                style={{
                  position: 'relative',
                  width: `${SHEET_PAGE_W_MM}mm`,
                  height: `${SHEET_PAGE_H_MM}mm`,
                  margin: 0,
                  padding: 0,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  pageBreakAfter: pageIdx < totalPages - 1 ? 'always' : 'auto',
                  pageBreakInside: 'avoid',
                }}
              >
                {Array.from({ length: SHEET_ROWS_PER_PAGE }, (_, r) =>
                  Array.from({ length: SHEET_COLS }, (_, c) => {
                    const stickerIdx = pageIdx * SHEET_STICKERS_PER_PAGE + r * SHEET_COLS + c;
                    const hasSticker = stickerIdx < stickerCount;
                    const left = SHEET_COL_LEFT_MM[c];
                    const top = SHEET_ROW_TOP_MM[r];

                    return (
                      <div
                        key={`slot-${pageIdx}-${r}-${c}`}
                        style={{
                          position: 'absolute',
                          left: `${left}mm`,
                          top: `${top}mm`,
                          width: `${SHEET_BLOCK_W_MM}mm`,
                          boxSizing: 'border-box',
                        }}
                      >
                        {hasSticker && (
                          <StickerContent svgRef={setPrintRef(stickerIdx)} isPrint={true} />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        <div className="modal-footer no-print">
          <button onClick={onClose} className="btn btn-secondary btn-md">
            Close
          </button>
          <button
            onClick={handlePrint}
            disabled={!product.barcode}
            className="btn btn-primary btn-md flex items-center space-x-2"
          >
            <Printer className="h-5 w-5" />
            <span>Print Stickers</span>
          </button>
        </div>

        <style>
          {`
            @media print {
              .no-print { display: none !important; }
              .print-body-hidden { display: none !important; }
              .print-body-visible { display: block !important; visibility: visible !important; }
              #sticker-print-area-clone {
                display: block !important; visibility: visible !important;
                position: absolute; left: 0; top: 0; width: 100%;
              }
              #sticker-print-area-clone, #sticker-print-area-clone * { visibility: visible !important; }
              #sticker-print-area-clone svg { shape-rendering: crispEdges; }
              @page {
                size: ${pageSizeW}mm ${pageSizeH}mm;
                margin: 0mm;
              }
              html, body { margin: 0; padding: 0; width: ${pageSizeW}mm; }
            }
          `}
        </style>
      </div>
    </div>
  );
}