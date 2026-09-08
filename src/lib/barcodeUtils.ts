import JsBarcode from 'jsbarcode';

export function generateBarcodeNumber(productName: string, sku?: string): string {
  const timestamp = Date.now().toString().slice(-6);
  const cleanName = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const cleanSku = (sku || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 2)
    .padEnd(2, '0');
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${cleanName}${cleanSku}${timestamp}${random}`;
}

export function generateSimpleBarcodeNumber(): string {
  const prefix = 'PRD';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

export function renderBarcodeToCanvas(
  canvas: HTMLCanvasElement,
  barcodeValue: string,
  options?: {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
  }
): void {
  try {
    JsBarcode(canvas, barcodeValue, {
      format: options?.format || 'CODE128',
      width: options?.width || 2,
      height: options?.height || 60,
      displayValue: options?.displayValue !== false,
      fontSize: options?.fontSize || 14,
      margin: options?.margin ?? 8,
      background: '#ffffff',
      lineColor: '#000000',
    });
  } catch (error) {
    console.error('Error rendering barcode:', error);
  }
}

export function barcodeToDataURL(
  barcodeValue: string,
  options?: {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
  }
): string {
  const canvas = document.createElement('canvas');
  renderBarcodeToCanvas(canvas, barcodeValue, options);
  return canvas.toDataURL('image/png');
}
