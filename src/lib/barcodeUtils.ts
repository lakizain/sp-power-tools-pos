import JsBarcode from 'jsbarcode';

export function calculateEan13CheckDigit(digits12: string): string {
  const clean = digits12.replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  const weights = [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean[i], 10) * weights[i];
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

export function generateEan13(sku?: string): string {
  const prefix = Math.floor(Math.random() * 900 + 100).toString();
  const cleanSku = (sku || '')
    .toUpperCase()
    .replace(/[^0-9]/g, '')
    .slice(0, 5)
    .padStart(5, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const first12 = `${prefix}${cleanSku}${random}`.slice(0, 12);
  return first12 + calculateEan13CheckDigit(first12);
}

export function isValidEan13(value: string): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 13) return false;
  const first12 = digits.slice(0, 12);
  const checkDigit = digits[12];
  const expected = calculateEan13CheckDigit(first12);
  return checkDigit === expected;
}

export function toValidEan13(value: string): string {
  if (!value) value = '';
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 13) {
    return digits.slice(0, 13);
  }
  if (digits.length === 12) {
    return digits + calculateEan13CheckDigit(digits);
  }
  const padded12 = digits.padStart(12, '0').slice(0, 12);
  return padded12 + calculateEan13CheckDigit(padded12);
}

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

export function renderBarcodeToSvg(
  svgElement: SVGSVGElement,
  barcodeValue: string,
  options?: {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    textAlign?: 'left' | 'center' | 'right';
    textPosition?: 'top' | 'bottom';
    font?: string;
  }
): void {
  try {
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    JsBarcode(svgElement, barcodeValue, {
      format: options?.format || 'CODE128',
      width: options?.width || 2,
      height: options?.height || 60,
      displayValue: options?.displayValue !== false,
      fontSize: options?.fontSize || 14,
      margin: options?.margin ?? 0,
      marginTop: options?.marginTop ?? 0,
      marginBottom: options?.marginBottom ?? 0,
      marginLeft: options?.marginLeft ?? 0,
      marginRight: options?.marginRight ?? 0,
      textAlign: options?.textAlign || 'center',
      textPosition: options?.textPosition || 'bottom',
      font: options?.font || 'monospace',
      background: '#ffffff',
      lineColor: '#000000',
    });
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  } catch (error) {
    console.error('Error rendering SVG barcode:', error);
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
