import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Plus, Minus } from 'lucide-react';
import { Product } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { renderBarcodeToCanvas } from '../../lib/barcodeUtils';

interface BarcodeStickerPrintProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export function BarcodeStickerPrint({ isOpen, onClose, product }: BarcodeStickerPrintProps) {
  const { state } = useApp();
  const [stickerCount, setStickerCount] = useState(1);
  const [stickerSize, setStickerSize] = useState<'small' | 'medium' | 'large'>('medium');
  const stickerCanvasesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const stickerDimensions = {
    small: { width: 200, height: 100, productFontSize: 10, priceFontSize: 12, barcodeHeight: 35, fontSize: 9 },
    medium: { width: 280, height: 140, productFontSize: 12, priceFontSize: 16, barcodeHeight: 50, fontSize: 11 },
    large: { width: 380, height: 180, productFontSize: 14, priceFontSize: 20, barcodeHeight: 65, fontSize: 13 },
  };

  useEffect(() => {
    if (!isOpen || !product?.barcode) return;
    const dims = stickerDimensions[stickerSize];
    stickerCanvasesRef.current.forEach((canvas, index) => {
      if (canvas) {
        renderBarcodeToCanvas(canvas, product.barcode!, {
          height: dims.barcodeHeight,
          fontSize: dims.fontSize,
          width: stickerSize === 'small' ? 1 : stickerSize === 'medium' ? 1.5 : 2,
          margin: 4,
        });
      }
    });
  }, [isOpen, product?.barcode, stickerCount, stickerSize, product?.id]);

  if (!isOpen) return null;

  if (!product) return null;

  const handlePrint = () => {
    const dims = stickerDimensions[stickerSize];
    stickerCanvasesRef.current.forEach((canvas, index) => {
      if (canvas && product?.barcode && index >= 10000) {
        renderBarcodeToCanvas(canvas, product.barcode!, {
          height: dims.barcodeHeight,
          fontSize: dims.fontSize,
          width: stickerSize === 'small' ? 1 : stickerSize === 'medium' ? 1.5 : 2,
          margin: 4,
        });
      }
    });

    setTimeout(() => {
      const originalPrintArea = document.getElementById('sticker-print-area');
      if (!originalPrintArea) return;

      const clonedPrintArea = originalPrintArea.cloneNode(true) as HTMLElement;
      clonedPrintArea.id = 'sticker-print-area-clone';
      clonedPrintArea.style.display = 'block';
      clonedPrintArea.style.position = 'absolute';
      clonedPrintArea.style.left = '0';
      clonedPrintArea.style.top = '0';
      clonedPrintArea.style.width = '100%';
      clonedPrintArea.style.padding = '16px 32px';
      clonedPrintArea.style.zIndex = '99999';
      clonedPrintArea.style.background = '#ffffff';

      const clonedCanvases = clonedPrintArea.querySelectorAll('canvas');
      const originalCanvases = originalPrintArea.querySelectorAll('canvas');
      clonedCanvases.forEach((canvas, i) => {
        const target = canvas as HTMLCanvasElement;
        const source = originalCanvases[i] as HTMLCanvasElement;
        if (source && target) {
          const ctx = target.getContext('2d');
          target.width = source.width;
          target.height = source.height;
          if (ctx) {
            ctx.drawImage(source, 0, 0);
          }
        }
      });

      const bodyChildren = Array.from(document.body.children) as HTMLElement[];
      bodyChildren.forEach((child) => {
        child.classList.add('print-body-hidden');
      });

      document.body.appendChild(clonedPrintArea);
      clonedPrintArea.classList.add('print-body-visible');

      window.print();

      setTimeout(() => {
        clonedPrintArea.remove();
        bodyChildren.forEach((child) => {
          child.classList.remove('print-body-hidden');
        });
      }, 300);
    }, 250);
  };

  const setCanvasRef = (index: number) => (el: HTMLCanvasElement | null) => {
    if (el) {
      stickerCanvasesRef.current.set(index, el);
    }
  };

  const dims = stickerDimensions[stickerSize];
  const displayPrice = product.isWeightBased
    ? `${state.settings.currency} ${(product.pricePerUnit || 0).toFixed(2)} / ${product.unit || 'kg'}`
    : `${state.settings.currency} ${product.price.toFixed(2)}`;

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sticker Size
              </label>
              <select
                value={stickerSize}
                onChange={(e) => setStickerSize(e.target.value as 'small' | 'medium' | 'large')}
                className="select w-full"
              >
                <option value="small">Small (2" × 1")</option>
                <option value="medium">Medium (2.8" × 1.4")</option>
                <option value="large">Large (3.8" × 1.8")</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Stickers
              </label>
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
                  onChange={(e) => setStickerCount(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
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

            <div className="flex items-end">
              <div className="card p-3 bg-gray-50 w-full">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Barcode:</span>
                    <span className="font-mono font-semibold text-gray-700">{product.barcode || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SKU:</span>
                    <span className="font-mono text-gray-700">{product.sku}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Preview ({stickerCount} sticker{stickerCount > 1 ? 's' : ''})</h3>
            <div className="bg-gray-100 rounded-xl p-4 max-h-96 overflow-y-auto">
              <div className="grid gap-4 justify-center" style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${dims.width + 16}px, 1fr))`
              }}>
                {Array.from({ length: Math.min(stickerCount, 20) }, (_, i) => (
                  <div
                    key={i}
                    className="bg-white border border-gray-300 rounded-lg p-2 shadow-sm flex flex-col items-center justify-between mx-auto"
                    style={{ width: `${dims.width}px`, height: `${dims.height}px` }}
                  >
                    <div
                      className="text-center font-semibold text-gray-900 leading-tight w-full truncate px-1"
                      style={{ fontSize: `${dims.productFontSize}px` }}
                    >
                      {product.name}
                    </div>
                    <canvas
                      ref={setCanvasRef(i)}
                      style={{ maxWidth: '100%', height: `${dims.barcodeHeight + 20}px` }}
                    />
                    <div
                      className="text-center font-bold text-gray-900"
                      style={{ fontSize: `${dims.priceFontSize}px` }}
                    >
                      {displayPrice}
                    </div>
                  </div>
                ))}
                {stickerCount > 20 && (
                  <div className="flex items-center justify-center col-span-full py-4 text-sm text-gray-500">
                    ... +{stickerCount - 20} more stickers (will all print)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div id="sticker-print-area" className="hidden print:block px-8 py-4">
          <div
            className="grid gap-2 p-2"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${dims.width}px, 1fr))`,
              pageBreakInside: 'avoid',
            }}
          >
            {Array.from({ length: stickerCount }, (_, i) => (
              <div
                key={`print-${i}`}
                className="border border-gray-400 rounded p-1 flex flex-col items-center justify-between break-inside-avoid"
                style={{
                  width: `${dims.width}px`,
                  height: `${dims.height}px`,
                  pageBreakInside: 'avoid',
                }}
              >
                <div
                  className="text-center font-semibold text-black leading-tight w-full truncate px-1"
                  style={{ fontSize: `${dims.productFontSize}px` }}
                >
                  {product.name}
                </div>
                <canvas
                  ref={setCanvasRef(i + 10000)}
                  style={{ maxWidth: '100%', height: `${dims.barcodeHeight + 20}px` }}
                />
                <div
                  className="text-center font-bold text-black"
                  style={{ fontSize: `${dims.priceFontSize}px` }}
                >
                  {displayPrice}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer no-print">
          <button
            onClick={onClose}
            className="btn btn-secondary btn-md"
          >
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
              .no-print {
                display: none !important;
              }
              .print-body-hidden {
                display: none !important;
              }
              .print-body-visible {
                display: block !important;
                visibility: visible !important;
              }
              #sticker-print-area-clone {
                display: block !important;
                visibility: visible !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              #sticker-print-area-clone,
              #sticker-print-area-clone * {
                visibility: visible !important;
              }
              @page {
                margin: 0.5cm;
              }
            }
          `}
        </style>
      </div>
    </div>
  );
}
