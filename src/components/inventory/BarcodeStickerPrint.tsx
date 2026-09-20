import { useState, useEffect, useRef } from 'react';
import { X, Printer, Plus, Minus } from 'lucide-react';
import { Product } from '../../types';
import { renderBarcodeToCanvas } from '../../lib/barcodeUtils';

interface BarcodeStickerPrintProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export function BarcodeStickerPrint({ isOpen, onClose, product }: BarcodeStickerPrintProps) {
  if (!product || !isOpen) return null;
  const [quantity, setQuantity] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && product.barcode) {
      canvasRefs.current = canvasRefs.current.slice(0, quantity);
      canvasRefs.current.forEach((canvas) => {
        if (canvas && product.barcode) {
          renderBarcodeToCanvas(canvas, product.barcode, {
            format: 'CODE128',
            width: 1.5,
            height: 35,
            fontSize: 10,
            margin: 2,
          });
        }
      });
    }
  }, [isOpen, product.barcode, quantity]);

  const handlePrint = async () => {
    if (!product.barcode) {
      alert('Product does not have a barcode');
      return;
    }

    setIsPrinting(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to print barcodes');
        setIsPrinting(false);
        return;
      }

      const barcodeImages = canvasRefs.current
        .filter(canvas => canvas !== null)
        .map(canvas => canvas!.toDataURL('image/png'));

      const stickerWidth = 38;
      const stickerHeight = 25;

      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Barcode Stickers - ${product.name}</title>
          <style>
            @page {
              size: auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 5mm;
              display: grid;
              grid-template-columns: repeat(auto-fill, ${stickerWidth}mm);
              gap: 2mm;
              justify-content: center;
            }
            .sticker {
              width: ${stickerWidth}mm;
              height: ${stickerHeight}mm;
              border: 1px solid #ccc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 2mm;
              box-sizing: border-box;
              page-break-inside: avoid;
            }
            .sticker-name {
              font-size: 8pt;
              font-weight: bold;
              text-align: center;
              margin-bottom: 1mm;
              word-wrap: break-word;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .sticker-barcode {
              width: 100%;
              height: auto;
            }
            .sticker-price {
              font-size: 9pt;
              font-weight: bold;
              margin-top: 1mm;
            }
            @media print {
              body {
                margin: 0;
                padding: 2mm;
              }
              .sticker {
                border: none;
              }
            }
          </style>
        </head>
        <body>
      `;

      barcodeImages.forEach((imgSrc) => {
        html += `
          <div class="sticker">
            <div class="sticker-name">${product.name}</div>
            <img src="${imgSrc}" class="sticker-barcode" alt="Barcode" />
            <div class="sticker-price">Rs. ${product.price.toFixed(2)}</div>
          </div>
        `;
      });

      html += `
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setIsPrinting(false);
        }, 250);
      };
    } catch (error) {
      console.error('Error printing barcodes:', error);
      setIsPrinting(false);
    }
  };

  const handleQuantityChange = (delta: number) => {
    const newQuantity = Math.max(1, Math.min(50, quantity + delta));
    setQuantity(newQuantity);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-gray-900">Print Barcode Sticker</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="modal-body space-y-6">
          {/* Product Info */}
          <div className="bg-gray-50 p-4 rounded-xl">
            <h3 className="font-semibold text-gray-900 mb-2">{product.name}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">SKU:</span>
                <span className="ml-2 font-mono">{product.sku}</span>
              </div>
              <div>
                <span className="text-gray-500">Price:</span>
                <span className="ml-2 font-semibold">Rs. {product.price.toFixed(2)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Barcode:</span>
                <span className="ml-2 font-mono">{product.barcode}</span>
              </div>
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="h-5 w-5" />
            </button>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{quantity}</div>
              <div className="text-sm text-gray-500">stickers</div>
            </div>
            <button
              onClick={() => handleQuantityChange(1)}
              disabled={quantity >= 50}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Preview */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Preview ({quantity} sticker{quantity > 1 ? 's' : ''})</h4>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: Math.min(quantity, 8) }).map((_, index) => (
                <div
                  key={index}
                  className="border border-gray-300 rounded p-2 flex flex-col items-center justify-center"
                  style={{ aspectRatio: '38/25' }}
                >
                  <div className="text-[6px] font-bold text-center truncate w-full mb-1">{product.name}</div>
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[index] = el;
                    }}
                    className="w-full h-auto"
                  />
                  <div className="text-[7px] font-bold mt-1">Rs. {product.price.toFixed(2)}</div>
                </div>
              ))}
              {quantity > 8 && (
                <div className="flex items-center justify-center text-gray-400 text-xs">
                  +{quantity - 8} more
                </div>
              )}
            </div>
          </div>

          {/* Sticker Size Info */}
          <div className="text-center text-sm text-gray-500">
            <p>Sticker size: 38mm width × 25mm height</p>
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isPrinting}
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting || !product.barcode}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Printer className="h-4 w-4" />
            <span>{isPrinting ? 'Printing...' : 'Print Stickers'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
