import JsBarcode from 'jsbarcode';

export const MM_TO_PX_96DPI = 96 / 25.4;
export const XPRINTER_203DPI_DOT_MM = 1 / 8;

export const BARCODE_DEFAULTS = {
  MIN_MODULE_WIDTH_MM: 0.25,
  SAFE_MODULE_WIDTH_MM: 0.33,
  QUIET_ZONE_MODULES: 10,
} as const;

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
    flat?: boolean;
  }
): void {
  try {
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
      background: options?.flat ? 'transparent' : '#ffffff',
      lineColor: '#000000',
    });
  } catch (error) {
    console.error('Error rendering SVG barcode:', error);
  }
}

export interface RenderOptimizedPrintSvgResult {
  moduleWidthPx: number;
  moduleWidthMm: number;
  totalWidthPx: number;
  totalHeightPx: number;
  quietZonePx: number;
  symbolModules: number;
}

export function renderOptimizedPrintBarcodeSvg(
  svgElement: SVGSVGElement,
  barcodeValue: string,
  params: {
    availableWidthMm: number;
    availableHeightMm: number;
    minModuleWidthMm?: number;
    quietZoneModules?: number;
    displayValue?: boolean;
  }
): RenderOptimizedPrintSvgResult {
  const minModuleWidthMm = params.minModuleWidthMm ?? BARCODE_DEFAULTS.MIN_MODULE_WIDTH_MM;
  const quietZoneModules = params.quietZoneModules ?? BARCODE_DEFAULTS.QUIET_ZONE_MODULES;
  const displayValue = params.displayValue ?? false;

  const estimatedSymbolModules = estimateCode128Modules(barcodeValue);
  const totalModulesRequired = estimatedSymbolModules + quietZoneModules * 2;

  let moduleWidthMm = params.availableWidthMm / totalModulesRequired;
  if (moduleWidthMm < minModuleWidthMm) {
    moduleWidthMm = minModuleWidthMm;
  }
  const moduleWidthPx = Math.max(1, Math.round(moduleWidthMm * MM_TO_PX_96DPI));
  const actualModuleWidthMm = moduleWidthPx / MM_TO_PX_96DPI;

  const totalHeightPx = Math.max(10, Math.round(params.availableHeightMm * MM_TO_PX_96DPI));
  const quietZonePx = moduleWidthPx * quietZoneModules;

  svgElement.innerHTML = '';
  svgElement.setAttribute('shape-rendering', 'crispEdges');
  svgElement.setAttribute('image-rendering', 'pixelated');

  renderBarcodeToSvg(svgElement, barcodeValue, {
    format: 'CODE128',
    width: moduleWidthPx,
    height: totalHeightPx,
    displayValue,
    margin: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: quietZonePx,
    marginRight: quietZonePx,
    font: 'monospace',
    flat: true,
  });

  const bboxW = Number(svgElement.getAttribute('width')) || 0;
  const bboxH = Number(svgElement.getAttribute('height')) || 0;

  svgElement.setAttribute('viewBox', `0 0 ${bboxW} ${bboxH}`);
  svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgElement.style.width = `${(bboxW / MM_TO_PX_96DPI).toFixed(3)}mm`;
  svgElement.style.height = `${(bboxH / MM_TO_PX_96DPI).toFixed(3)}mm`;
  svgElement.style.display = 'block';
  svgElement.style.maxWidth = '100%';
  svgElement.style.maxHeight = '100%';
  svgElement.style.margin = '0 auto';

  return {
    moduleWidthPx,
    moduleWidthMm: actualModuleWidthMm,
    totalWidthPx: bboxW,
    totalHeightPx: bboxH,
    quietZonePx,
    symbolModules: estimatedSymbolModules,
  };
}

export function estimateCode128Modules(value: string): number {
  if (!value) return 100;
  let sum = 11;
  const len = value.length;
  let i = 0;
  while (i < len) {
    if (value[i + 1] !== undefined && /^\d{2}$/.test(value.substring(i, i + 2))) {
      sum += 11;
      i += 2;
    } else {
      sum += 11;
      i += 1;
    }
  }
  sum += 13;
  return sum;
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
