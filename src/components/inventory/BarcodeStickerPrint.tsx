import { useState } from 'react';
import { X, Printer, Plus, Minus } from 'lucide-react';
import { Product } from '../../types';

interface BarcodeStickerPrintProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

// ---------- Code 128 ----------
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

  if (/^\d{4,}$/.test(text)) {
    // All digits -> Start C (2 digits per symbol = compact, wide bars)
    start = 105;
    const pairsLen = text.length - (text.length % 2);
    for (let i = 0; i < pairsLen; i += 2) {
      codes.push(parseInt(text.substr(i, 2), 10));
    }
    // Odd length: switch to Code B for the last digit
    if (text.length % 2 === 1) {
      codes.push(100); // Code B
      codes.push(text.charCodeAt(text.length - 1) - 32);
    }
  } else {
    start = 104; // Start B
    for (const ch of text) codes.push(ch.charCodeAt(0) - 32);
  }

  let sum = start;
  codes.forEach((c, i) => { sum += c * (i + 1); });
  const check = sum % 103;

  return [start, ...codes, check, 106].map(c => PATTERNS[c]).join("");
}

/**
 * snapToDots = false -> barcode label එකේ පළල පුරා විහිදෙනවා
 * snapToDots = true  -> printer dots වලට integer කරනවා (පළල අඩුයි, ඒත් bars හරියටම සමානයි)
 */
function barcodeSVG(
  text: string,
  maxWidthMm: number,
  heightMm: number,
  dotsPerMm: number,
  snapToDots = false
): string {
  const pattern = code128Pattern(text);
  const quiet = 4;
  let totalModules = quiet * 2;
  for (const d of pattern) totalModules += +d;

  let widthMm = maxWidthMm;
  if (snapToDots) {
    const dots = Math.max(1, Math.floor((maxWidthMm * dotsPerMm) / totalModules));
    widthMm = totalModules * (dots / dotsPerMm);
  }

  let x = quiet, rects = "";
  for (let i = 0; i < pattern.length; i++) {
    const w = +pattern[i];
    if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="1"/>`;
    x += w;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm.toFixed(3)}mm" height="${heightMm}mm" viewBox="0 0 ${totalModules} 1" preserveAspectRatio="none" fill="#000">${rects}</svg>`;
}

// ---------- Printer / label settings (XPrinter XP-T361U) ----------
const LABEL_W = 38;   // mm
const LABEL_H = 25;   // mm
const MARGIN = 1.5;   // mm
const OFFSET_X = 1.5; // mm  content එක දකුණට ගන්න ප්‍රමාණය (වැඩි කළොත් තව දකුණට යනවා)
const BAR_H = 8;      // mm  (barcode උස)
const DPM = 8;        // dots per mm (203 dpi)
const SNAP_TO_DOTS = false; // scan වෙන්නේ නැත්නම් true කරලා බලන්න

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STICKER_CSS = `
.stk {
  width: ${LABEL_W}mm;
  height: ${(LABEL_H - 0.3).toFixed(2)}mm;
  padding: ${MARGIN}mm ${MARGIN}mm ${MARGIN}mm ${MARGIN + OFFSET_X}mm;
  box-sizing: border-box;
  overflow: hidden;
  background: #fff;
  color: #000;
  font-family: Arial, Helvetica, sans-serif;
}
.stk-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
}
.stk-name {
  width: 100%;
  height: 6mm;
  font-weight: 700;
  line-height: 1.05;
  text-transform: uppercase;
  text-align: left;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}
.stk-bar { width: 100%; height: ${BAR_H}mm; }
.stk-bar svg { display: block; shape-rendering: crispEdges; }
.stk-price { font-size: 10pt; font-weight: 700; line-height: 1; white-space: nowrap; }
.stk-code  { font-size: 8pt; font-weight: 700; line-height: 1; letter-spacing: 0.14em; white-space: nowrap; }
`;

function stickerHtml(name: string, barcode: string, price: number): string {
  const innerW = LABEL_W - MARGIN * 2 - OFFSET_X;
  const svg = barcodeSVG(barcode, innerW, BAR_H, DPM, SNAP_TO_DOTS);
  // නමේ දිග අනුව font size එක
  const len = name.length;
  const nameFont = len <= 24 ? 8 : len <= 36 ? 7 : 6;

  return `
    <div class="stk"><div class="stk-inner">
      <div class="stk-name" style="font-size:${nameFont}pt">${escapeHtml(name)}</div>
      <div class="stk-bar">${svg}</div>
      <div class="stk-price">LKR. ${price.toFixed(2)}</div>
      <div class="stk-code">${escapeHtml(barcode)}</div>
    </div></div>`;
}

export function BarcodeStickerPrint({ isOpen, onClose, product }: BarcodeStickerPrintProps) {
  // Hooks always before any early return
  const [quantity, setQuantity] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!product || !isOpen) return null;

  const handlePrint = () => {
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

      const one = stickerHtml(product.name, product.barcode, product.price);
      const labels = Array.from({ length: quantity }, () => one).join('');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Barcode Sticker - ${escapeHtml(product.name)}</title>
  <style>
    @page { size: ${LABEL_W}mm ${LABEL_H}mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    ${STICKER_CSS}
    .stk { break-after: page; page-break-after: always; }
    .stk:last-child { break-after: auto; page-break-after: auto; }
  </style>
</head>
<body>${labels}</body>
</html>`;

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
    setQuantity(q => Math.max(1, Math.min(50, q + delta)));
  };

  const previewHtml = product.barcode
    ? stickerHtml(product.name, product.barcode, product.price)
    : '';

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
                <span className="ml-2 font-semibold">LKR. {product.price.toFixed(2)}</span>
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

          {/* Preview (exact print layout, 3x) */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Preview ({quantity} sticker{quantity > 1 ? 's' : ''})
            </h4>
            <style>{STICKER_CSS}</style>
            <div className="flex justify-center">
              <div
                className="border border-gray-300 shadow-sm overflow-hidden"
                style={{ width: `${LABEL_W * 3}mm`, height: `${(LABEL_H - 0.3) * 3}mm` }}
              >
                <div
                  style={{ transform: 'scale(3)', transformOrigin: 'top left', width: `${LABEL_W}mm` }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>Sticker size: 38mm width × 25mm height (XPrinter XP-T361U)</p>
            <p className="text-xs mt-1">Printer: XP-T361U, 203 DPI (8 dots/mm)</p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary" disabled={isPrinting}>
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