import { useState } from 'react';
import { X, Printer, Plus, Minus } from 'lucide-react';
import { Product } from '../../types';

interface BarcodeStickerPrintProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

// Code 128 patterns from the reference implementation
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112"
];

function code128Pattern(text: string): string {
  const codes: number[] = [];
  let start: number;
  
  if (/^\d{4,}$/.test(text) && text.length % 2 === 0) {
    start = 105; // Start C
    for (let i = 0; i < text.length; i += 2) {
      codes.push(parseInt(text.substr(i, 2), 10));
    }
  } else {
    start = 104; // Start B
    for (const ch of text) {
      codes.push(ch.charCodeAt(0) - 32);
    }
  }
  
  let sum = start;
  codes.forEach((c, i) => { sum += c * (i + 1); });
  const check = sum % 103;
  const all = [start, ...codes, check, 106];
  
  return all.map(c => PATTERNS[c]).join("");
}

function barcodeSVG(text: string, maxWidthMm: number, heightMm: number, dotsPerMm: number): string {
  const pattern = code128Pattern(text);
  const quiet = 4;
  let totalModules = 0;
  for (const d of pattern) totalModules += +d;
  totalModules += quiet * 2;

  const availDots = Math.floor(maxWidthMm * dotsPerMm);
  const dots = Math.max(1, Math.floor(availDots / totalModules));
  const widthMm = totalModules * (dots / dotsPerMm);

  let x = quiet, rects = "";
  for (let i = 0; i < pattern.length; i++) {
    const w = +pattern[i];
    if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="1"/>`;
    x += w;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm.toFixed(3)}mm" height="${heightMm}mm" viewBox="0 0 ${totalModules} 1" preserveAspectRatio="none" fill="#000">${rects}</svg>`;
}

export function BarcodeStickerPrint({ isOpen, onClose, product }: BarcodeStickerPrintProps) {
  if (!product || !isOpen) return null;
  
  const [quantity, setQuantity] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Printer settings for XPrinter XP-T361U
  const LABEL_W = 38; // mm
  const LABEL_H = 25; // mm
  const MARGIN = 1.5; // mm
  const OFFSET_X = 0; // mm
  const OFFSET_Y = 0; // mm
  const BAR_H = 14; // mm
  const DPM = 8; // dots per mm (203 dpi)
  const FONT_PT = 8;

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

      const innerW = LABEL_W - MARGIN * 2;
      const barcodeSvg = barcodeSVG(product.barcode, innerW, BAR_H, DPM);

      let html = `
        <!DOCTYPE html>
        <html lang="si">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Barcode Sticker - ${product.name}</title>
          <style>
            @page { size: ${LABEL_W}mm ${LABEL_H}mm; margin: 0; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: Arial, sans-serif;
            }
            .sheet {
              display: grid;
              grid-template-columns: repeat(auto-fill, ${LABEL_W}mm);
              gap: 0;
              justify-content: center;
            }
            .label {
              background: #fff;
              color: #000;
              width: ${LABEL_W}mm;
              height: ${(LABEL_H - 0.3).toFixed(2)}mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              position: relative;
            }
            .label .inner {
              width: ${innerW}mm;
              left: ${OFFSET_X}mm;
              top: ${OFFSET_Y}mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              position: relative;
            }
            .label .name {
              font-size: 7pt;
              font-weight: bold;
              text-align: center;
              margin-bottom: 0.5mm;
              word-wrap: break-word;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label .code {
              letter-spacing: 0.06em;
              font-size: ${FONT_PT}pt;
              margin-top: 0.8mm;
            }
            .label .price {
              font-size: 9pt;
              font-weight: bold;
              margin-top: 0.5mm;
            }
            .label svg {
              display: block;
              shape-rendering: crispEdges;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
      `;

      for (let i = 0; i < quantity; i++) {
        html += `
          <div class="label">
            <div class="inner">
              <div class="name">${product.name}</div>
              ${barcodeSvg}
              <div class="code">${product.barcode}</div>
              <div class="price">Rs. ${product.price.toFixed(2)}</div>
            </div>
          </div>
        `;
      }

      html += `
          </div>
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

  // Generate preview SVG
  const innerW = LABEL_W - MARGIN * 2;
  const previewBarcodeSvg = product.barcode ? barcodeSVG(product.barcode, innerW, BAR_H, DPM) : '';

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
                  <div 
                    className="text-[6px] font-bold text-center truncate w-full mb-1"
                    dangerouslySetInnerHTML={{ __html: product.name }}
                  />
                  <div 
                    className="w-full h-auto"
                    dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
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
            <p>Sticker size: 38mm width × 25mm height (XPrinter XP-T361U)</p>
            <p className="text-xs mt-1">Printer: XP-T361U, 203 DPI (8 dots/mm)</p>
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
