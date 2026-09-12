import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import {
  renderBarcodeToSvg,
  normalizeCode128Value,
} from '../../lib/barcodeUtils';
import { X, Printer, Minus, Plus } from 'lucide-react';

/**
 * ============================================================
 * PRINT CONFIGURATION
 * ============================================================
 *
 * IMPORTANT:
 *
 * Thermal/Xprinter:
 *   Physical sticker = 38mm × 25mm
 *
 * A4:
 *   Physical sticker = 40mm × 27mm
 *   Sheet = 210mm × 297mm
 *   Grid = 4 columns × 8 rows
 *
 * These two configurations are intentionally kept separate.
 */

/**
 * ============================================================
 * THERMAL / XPRINTER CONFIG
 * ============================================================
 *
 * Xprinter XP-365B
 * Physical sticker roll:
 *   Width  = 38mm
 *   Height = 25mm
 *
 * Thermal preview/print is rendered on an 80mm roll canvas,
 * while each physical label remains 38mm × 25mm and is
 * left-aligned on the media to match the printer example.
 */
const THERMAL_CONFIG = {
  pageWidthMm: 80,
  pageHeightMm: 25,

  stickerWidthMm: 38,
  stickerHeightMm: 25,

  /**
   * Safe content margins.
   *
   * Physical sticker is 38mm wide.
   * Content area = 36mm.
   */
  marginLeftMm: 1.0,
  marginRightMm: 1.0,
  marginTopMm: 1.0,
  marginBottomMm: 1.0,

  companyNameHeightMm: 2.4,

  productNameBaseHeightMm: 3.2,
  productNameMaxLines: 2,

  priceHeightMm: 3.3,

  /**
   * Barcode number area.
   */
  barcodeNumberHeightMm: 2.8,

  /**
   * Small vertical gaps to maximize usable sticker area.
   */
  gapMm: 0.25,

  /**
   * 35mm barcode inside 36mm content area.
   *
   * Do NOT use 37mm here because the content width is only 36mm.
   */
  barcodeWidthMm: 34.8,

  barcodeMinHeightMm: 8.2,
  barcodeMaxHeightMm: 8.8,

  companyNameFontSizePt: 8.0,
  productNameFontSizePt: 8.4,
  productNameFontSizeSmallPt: 7.4,
  priceFontSizePt: 10.5,
  barcodeNumberFontSizePt: 7.2,
} as const;

const THERMAL_ROLL_CONFIG = {
  mediaWidthMm: 80,
  stickerOffsetLeftMm: 0,
  stickerOffsetTopMm: 4.5,
  stickerGapMm: 7,
  bottomPaddingMm: 4.5,
  previewMaxCopies: 3,
} as const;

const THERMAL_50_CONFIG = {
  pageWidthMm: 80,
  pageHeightMm: 25,

  stickerWidthMm: 50,
  stickerHeightMm: 25,

  marginLeftMm: 1.0,
  marginRightMm: 1.0,
  marginTopMm: 1.0,
  marginBottomMm: 1.0,

  companyNameHeightMm: 1.9,

  productNameBaseHeightMm: 2.6,
  productNameMaxLines: 2,

  priceHeightMm: 2.8,

  barcodeNumberHeightMm: 2.6,

  gapMm: 0.25,

  barcodeWidthMm: 46.8,

  barcodeMinHeightMm: 10.0,
  barcodeMaxHeightMm: 11.0,

  companyNameFontSizePt: 6.8,
  productNameFontSizePt: 7.0,
  productNameFontSizeSmallPt: 6.2,
  priceFontSizePt: 9.2,
  barcodeNumberFontSizePt: 6.6,
} as const;

const THERMAL_50_ROLL_CONFIG = {
  mediaWidthMm: 80,
  stickerOffsetLeftMm: 15,
  stickerOffsetTopMm: 4.5,
  stickerGapMm: 7,
  bottomPaddingMm: 4.5,
  previewMaxCopies: 3,
} as const;

/**
 * ============================================================
 * A4 STICKER CONFIG
 * ============================================================
 */
const A4_STICKER_CONFIG = {
  stickerWidthMm: 40,
  stickerHeightMm: 27,

  marginLeftMm: 1.0,
  marginRightMm: 1.0,
  marginTopMm: 0.8,
  marginBottomMm: 0.8,

  companyNameHeightMm: 1.8,

  productNameBaseHeightMm: 1.9,
  productNameMaxLines: 2,

  priceHeightMm: 2.6,

  barcodeNumberHeightMm: 3.2,

  gapMm: 0.3,

  barcodeWidthMm: 37.0,
  barcodeMinHeightMm: 12.5,
  barcodeMaxHeightMm: 14.5,

  companyNameFontSizePt: 5.5,
  productNameFontSizePt: 5.5,
  productNameFontSizeSmallPt: 5.0,
  priceFontSizePt: 8.0,
  barcodeNumberFontSizePt: 9.0,
} as const;

/**
 * ============================================================
 * A4 GRID CONFIG
 * ============================================================
 */
const A4_GRID_CONFIG = {
  pageWidthMm: 210,
  pageHeightMm: 297,

  columns: 4,
  rows: 8,

  marginXMm: 9,
  marginYMm: 6.5,

  horizontalGapMm: 10,
  verticalGapMm: 9,

  showBorder: true,
} as const;

type PrintMode = 'thermal' | 'thermal50' | 'a4grid';

type StickerConfig =
  | typeof THERMAL_CONFIG
  | typeof THERMAL_50_CONFIG
  | typeof A4_STICKER_CONFIG;

type RollConfig =
  | typeof THERMAL_ROLL_CONFIG
  | typeof THERMAL_50_ROLL_CONFIG;

/**
 * Convert number to CSS mm.
 */
function mm(n: number): string {
  return `${n.toFixed(3)}mm`;
}

/**
 * ============================================================
 * GET ACTIVE STICKER CONFIG
 * ============================================================
 */
function getStickerConfig(mode: PrintMode): StickerConfig {
  switch (mode) {
    case 'thermal':
      return THERMAL_CONFIG;
    case 'thermal50':
      return THERMAL_50_CONFIG;
    default:
      return A4_STICKER_CONFIG;
  }
}

function getRollConfig(mode: PrintMode): RollConfig {
  return mode === 'thermal50'
    ? THERMAL_50_ROLL_CONFIG
    : THERMAL_ROLL_CONFIG;
}

/**
 * ============================================================
 * CALCULATE STICKER CONTENT LAYOUT
 * ============================================================
 */
function calculateLayout(
  productNameStr: string,
  config: StickerConfig
) {
  const isThermal =
    config !== A4_STICKER_CONFIG;

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
  } = config;

  const contentWidthMm =
    stickerWidthMm -
    marginLeftMm -
    marginRightMm;

  const contentHeightMm =
    stickerHeightMm -
    marginTopMm -
    marginBottomMm;

  /**
   * Determine product name lines.
   */
  const nameLength = productNameStr.trim().length;

  let productNameLines = 1;

  if (nameLength > 20) {
    productNameLines = 2;
  }

  productNameLines = Math.min(
    productNameLines,
    productNameMaxLines
  );

  const productNameHeightMm =
    productNameBaseHeightMm * productNameLines;

  /**
   * Thermal uses:
   * Company -> Product -> Barcode -> Price
   *
   * A4 uses:
   * Company -> Product -> Price -> Barcode -> Barcode number
   */
  const fixedGaps =
    gapMm * 4;

  const barcodeNumberReservedHeightMm =
    barcodeNumberHeightMm;

  const fixedElementsHeightMm =
    companyNameHeightMm +
    productNameHeightMm +
    priceHeightMm +
    barcodeNumberReservedHeightMm +
    fixedGaps;

  /**
   * Remaining space goes to barcode.
   */
  let barcodeHeightMm =
    contentHeightMm -
    fixedElementsHeightMm;

  barcodeHeightMm = Math.max(
    barcodeHeightMm,
    barcodeMinHeightMm
  );

  barcodeHeightMm = Math.min(
    barcodeHeightMm,
    barcodeMaxHeightMm
  );

  /**
   * ============================================================
   * VERTICAL LAYOUT
   * ============================================================
   */

  let yCursor = marginTopMm;

  /**
   * Company name
   */
  const companyName = {
    x: marginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: companyNameHeightMm,
  };

  yCursor += companyNameHeightMm + gapMm;

  /**
   * Product name
   */
  const productName = {
    x: marginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: productNameHeightMm,
    lines: productNameLines,
  };

  yCursor += productNameHeightMm + gapMm;

  /**
   * Thermal: barcode left-aligned with content margin.
   * A4 grid: barcode horizontally centered.
   */
  const barcodeX = isThermal
    ? marginLeftMm
    : marginLeftMm +
      (contentWidthMm - barcodeWidthMm) / 2;

  const barcode = {
    x: barcodeX,
    y: yCursor,
    width: barcodeWidthMm,
    height: barcodeHeightMm,
  };

  yCursor += barcodeHeightMm + gapMm;

  /**
   * Thermal label follows the example:
   * company -> product -> barcode -> price
   *
   * A4 keeps:
   * company -> product -> price -> barcode -> number
   */
  const price = {
    x: marginLeftMm,
    y: isThermal ? yCursor : productName.y + productName.height + gapMm,
    width: contentWidthMm,
    height: priceHeightMm,
  };

  if (isThermal) {
    yCursor += priceHeightMm + gapMm;
  }

  /**
   * Barcode number
   */
  const barcodeNumber = {
    x: marginLeftMm,
    y: yCursor,
    width: contentWidthMm,
    height: barcodeNumberHeightMm,
  };

  if (!isThermal) {
    barcode.y =
      price.y + price.height + gapMm;

    barcodeNumber.y =
      barcode.y +
      barcode.height +
      gapMm;
  }

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

/**
 * ============================================================
 * A4 GRID POSITION
 * ============================================================
 *
 * COLUMN-MAJOR
 *
 * Required order:
 *
 * [ 1  9 17 25 ]
 * [ 2 10 18 26 ]
 * [ 3 11 19 27 ]
 * [ 4 12 20 28 ]
 * [ 5 13 21 29 ]
 * [ 6 14 22 30 ]
 * [ 7 15 23 31 ]
 * [ 8 16 24 32 ]
 *
 * This is vertical-first / column-major.
 */
function getGridPosition(
  stickerIndex: number
): {
  page: number;
  row: number;
  col: number;
  xMm: number;
  yMm: number;
} {
  const {
    columns,
    rows,
    marginXMm,
    marginYMm,
    horizontalGapMm,
    verticalGapMm,
  } = A4_GRID_CONFIG;

  const {
    stickerWidthMm,
    stickerHeightMm,
  } = A4_STICKER_CONFIG;

  const stickersPerPage =
    columns * rows;

  const page =
    Math.floor(
      stickerIndex / stickersPerPage
    );

  const indexOnPage =
    stickerIndex % stickersPerPage;

  /**
   * COLUMN-MAJOR
   *
   * Column changes after `rows` stickers.
   */
  const col =
    Math.floor(indexOnPage / rows);

  const row =
    indexOnPage % rows;

  const xMm =
    marginXMm +
    col *
      (stickerWidthMm +
        horizontalGapMm);

  const yMm =
    marginYMm +
    row *
      (stickerHeightMm +
        verticalGapMm);

  return {
    page,
    row,
    col,
    xMm,
    yMm,
  };
}

/**
 * ============================================================
 * COMPONENT PROPS
 * ============================================================
 */
export interface BarcodeStickerPrintProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

/**
 * ============================================================
 * MAIN COMPONENT
 * ============================================================
 */
export function BarcodeStickerPrint({
  isOpen,
  onClose,
  product,
}: BarcodeStickerPrintProps) {
  const { state } = useApp();

  const [copies, setCopies] =
    useState(1);

  const [mode, setMode] =
    useState<PrintMode>('thermal');

  useEffect(() => {
    if (isOpen && product) {
      setMode('thermal');
    }
  }, [isOpen, product]);

  /**
   * ============================================================
   * PRODUCT DATA
   * ============================================================
   */
  const companyName =
    state.settings.storeName || '';

  const productName =
    product?.name || '';

  const priceValue =
    product?.price ?? 0;

  const barcodeValue =
    product?.barcode || '';

  const currency =
    state.settings.currency || 'LKR';

  /**
   * ============================================================
   * ACTIVE CONFIG
   * ============================================================
   */
  const stickerConfig =
    useMemo(
      () => getStickerConfig(mode),
      [mode]
    );

  const rollConfig =
    useMemo(
      () => getRollConfig(mode),
      [mode]
    );

  /**
   * ============================================================
   * ACTIVE STICKER LAYOUT
   * ============================================================
   */
  const layout =
    useMemo(
      () =>
        calculateLayout(
          productName,
          stickerConfig
        ),
      [
        productName,
        stickerConfig,
      ]
    );

  /**
   * Price font size.
   */
  const priceFontSize =
    (layout.price.height / 3.6) *
    stickerConfig.priceFontSizePt;

  /**
   * Product name font size.
   */
  const productNameFontSize =
    layout.productName.lines >= 2 ||
    productName.length > 22
      ? stickerConfig.productNameFontSizeSmallPt
      : stickerConfig.productNameFontSizePt;

  /**
   * ============================================================
   * A4 PAGE CALCULATIONS
   * ============================================================
   */
  const stickersPerPage =
    A4_GRID_CONFIG.columns *
    A4_GRID_CONFIG.rows;

  const totalPages =
    mode === 'a4grid'
      ? Math.ceil(
          copies / stickersPerPage
        )
      : copies;

  /**
   * ============================================================
   * PRINT HANDLER
   * ============================================================
   */
  const handlePrint = () => {
    setTimeout(() => {
      const stickerEl =
        document.getElementById(
          'barcode-sticker-sheet'
        );

      if (!stickerEl) {
        console.error(
          'Barcode sticker print root not found.'
        );
        return;
      }

      /**
       * Clone print content.
       */
      const clone =
        stickerEl.cloneNode(
          true
        ) as HTMLElement;

      clone.id =
        'barcode-sticker-print-root';

      /**
       * Set print root properties.
       */
      clone.style.position =
        'absolute';

      clone.style.left =
        '0';

      clone.style.top =
        '0';

      clone.style.zIndex =
        '999999';

      clone.style.background =
        '#ffffff';

      clone.style.display =
        'block';

      clone.style.visibility =
        'visible';

      clone.style.margin =
        '0';

      clone.style.padding =
        '0';

      clone.style.boxSizing =
        'border-box';

      /**
       * Hide existing application.
       */
      const bodyChildren =
        Array.from(
          document.body.children
        ) as HTMLElement[];

      bodyChildren.forEach(
        (child) => {
          child.classList.add(
            'print-body-hidden'
          );
        }
      );

      /**
       * Add cloned print root.
       */
      document.body.appendChild(
        clone
      );

      clone.classList.add(
        'print-body-visible'
      );

      clone.setAttribute(
        'data-print-mode',
        mode
      );

      /**
       * Trigger browser print.
       */
      window.print();

      /**
       * Clean up after printing.
       */
      setTimeout(() => {
        clone.remove();

        bodyChildren.forEach(
          (child) => {
            child.classList.remove(
              'print-body-hidden'
            );
          }
        );
      }, 500);
    }, 150);
  };

  /**
   * ============================================================
   * FORMAT PRICE
   * ============================================================
   */
  const formatPrice = (
    n: number
  ) => {
    return `${currency}. ${n.toLocaleString(
      'en-US',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  /**
   * Do not render if closed/no product.
   */
  if (!isOpen || !product) {
    return null;
  }

  const {
    companyName: cn,
    productName: pn,
    price: pr,
    barcode: bc,
    barcodeNumber: bn,
  } = layout;

  /**
   * ============================================================
   * STICKER CONTENT PROPS
   * ============================================================
   */
  const stickerContentProps = {
    companyName,
    productName,
    priceText:
      formatPrice(priceValue),

    barcodeValue,

    barcodeNumberFontSize:
      stickerConfig.barcodeNumberFontSizePt,

    companyNameFontSize:
      stickerConfig.companyNameFontSizePt,

    productNameFontSize,

    priceFontSize,

    cn,
    pn,
    pr,
    bc,
    bn,

    showBarcodeNumber: true,

    leftAlignContent: mode !== 'a4grid',

    showBorder:
      mode === 'a4grid' &&
      A4_GRID_CONFIG.showBorder,
  };

  /**
   * ============================================================
   * THERMAL SHEET
   * ============================================================
   */
  const renderThermalSheet = () => {
    const rollHeightMm =
      rollConfig.stickerOffsetTopMm +
      copies *
        stickerConfig.stickerHeightMm +
      Math.max(0, copies - 1) *
        rollConfig.stickerGapMm +
      rollConfig.bottomPaddingMm;

    return (
      <div
        style={{
          width: mm(
            rollConfig.mediaWidthMm
          ),
          minHeight: mm(rollHeightMm),
          position: 'relative',
          overflow: 'hidden',
          background: '#ffffff',
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
        }}
      >
        {Array.from({ length: copies }).map((_, i) => (
          <div
            key={`thermal-${i}`}
            style={{
              width: mm(
                stickerConfig.stickerWidthMm
              ),
              height: mm(
                stickerConfig.stickerHeightMm
              ),
              position: 'absolute',
              left: mm(
                rollConfig.stickerOffsetLeftMm
              ),
              top: mm(
                rollConfig.stickerOffsetTopMm +
                  i *
                    (stickerConfig.stickerHeightMm +
                      rollConfig.stickerGapMm)
              ),
              overflow: 'hidden',
              background: '#ffffff',
              margin: 0,
              padding: 0,
              boxSizing: 'border-box',
            }}
          >
            <StickerContent
              {...stickerContentProps}
              stickerKey={`t-${i}`}
              showBorder={true}
            />
          </div>
        ))}
      </div>
    );
  };

  /**
   * ============================================================
   * A4 GRID SHEET
   * ============================================================
   */
  const renderA4GridSheet = () => {
    const pages: JSX.Element[] =
      [];

    for (
      let p = 0;
      p < totalPages;
      p++
    ) {
      const startIdx =
        p * stickersPerPage;

      const endIdx =
        Math.min(
          startIdx +
            stickersPerPage,
          copies
        );

      const stickersOnPage:
        JSX.Element[] = [];

      for (
        let s = startIdx;
        s < endIdx;
        s++
      ) {
        const {
          xMm,
          yMm,
        } =
          getGridPosition(s);

        stickersOnPage.push(
          <div
            key={`sticker-${s}`}
            style={{
              position:
                'absolute',

              left: mm(xMm),
              top: mm(yMm),

              width: mm(
                A4_STICKER_CONFIG.stickerWidthMm
              ),

              height: mm(
                A4_STICKER_CONFIG.stickerHeightMm
              ),

              overflow:
                'hidden',

              background:
                '#ffffff',

              border:
                A4_GRID_CONFIG.showBorder
                  ? '0.2mm solid #d1d5db'
                  : 'none',

              boxSizing:
                'border-box',
            }}
          >
            <StickerContent
              {...stickerContentProps}
              stickerKey={`a4-${s}`}
              showBorder={false}
            />
          </div>
        );
      }

      pages.push(
        <div
          key={`page-${p}`}
          style={{
            width:
              mm(
                A4_GRID_CONFIG.pageWidthMm
              ),

            height:
              mm(
                A4_GRID_CONFIG.pageHeightMm
              ),

            position:
              'relative',

            pageBreakAfter:
              p <
              totalPages - 1
                ? 'always'
                : 'auto',

            breakAfter:
              p <
              totalPages - 1
                ? 'page'
                : 'auto',

            overflow:
              'hidden',

            background:
              '#ffffff',

            boxSizing:
              'border-box',

            margin: 0,
            padding: 0,
          }}
        >
          {stickersOnPage}
        </div>
      );
    }

    return pages;
  };

  /**
   * ============================================================
   * PREVIEW
   * ============================================================
   */
  const renderPreview = () => {
    /**
     * ----------------------------------------------------------
     * THERMAL PREVIEW
     * ----------------------------------------------------------
     */
    if (mode !== 'a4grid') {
      const pxPerMm =
        3.7795275591;

      const previewCopies =
        Math.min(
          copies,
          rollConfig.previewMaxCopies
        );

      const rollHeightMm =
        rollConfig.stickerOffsetTopMm +
        previewCopies *
          stickerConfig.stickerHeightMm +
        Math.max(
          0,
          previewCopies - 1
        ) *
          rollConfig.stickerGapMm +
        rollConfig.bottomPaddingMm;

      return (
        <div
          style={{
            width:
              `${rollConfig.mediaWidthMm * pxPerMm}px`,

            height:
              `${rollHeightMm * pxPerMm}px`,

            border: '1px solid #d1d5db',

            position:
              'relative',

            background:
              '#ffffff',

            flexShrink: 0,

            boxSizing:
              'border-box',

            overflow:
              'hidden',
          }}
        >
          {Array.from({
            length: previewCopies,
          }).map((_, i) => (
            <div
              key={`pv-thermal-${i}`}
              style={{
                position: 'absolute',
                left: `${rollConfig.stickerOffsetLeftMm * pxPerMm}px`,
                top: `${(rollConfig.stickerOffsetTopMm +
                  i *
                    (stickerConfig.stickerHeightMm +
                      rollConfig.stickerGapMm)) * pxPerMm}px`,
                width: `${stickerConfig.stickerWidthMm * pxPerMm}px`,
                height: `${stickerConfig.stickerHeightMm * pxPerMm}px`,
                background: '#ffffff',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <StickerContent
                {...stickerContentProps}
                stickerKey={`pv-thermal-${i}`}
                showBorder={true}
              />
            </div>
          ))}
        </div>
      );
    }

    /**
     * ----------------------------------------------------------
     * A4 PREVIEW
     * ----------------------------------------------------------
     */
    const previewScale = 2.2;

    const pageW =
      A4_GRID_CONFIG.pageWidthMm *
      previewScale;

    const pageH =
      A4_GRID_CONFIG.pageHeightMm *
      previewScale;

    const firstPageStickers =
      Math.min(
        copies,
        stickersPerPage
      );

    const previewStickers:
      JSX.Element[] = [];

    for (
      let s = 0;
      s < firstPageStickers;
      s++
    ) {
      const {
        xMm,
        yMm,
      } =
        getGridPosition(s);

      previewStickers.push(
        <div
          key={`pv-${s}`}
          style={{
            position:
              'absolute',

            left:
              `${xMm * previewScale}px`,

            top:
              `${yMm * previewScale}px`,

            width:
              `${A4_STICKER_CONFIG.stickerWidthMm * previewScale}px`,

            height:
              `${A4_STICKER_CONFIG.stickerHeightMm * previewScale}px`,

            border:
              A4_GRID_CONFIG.showBorder
                ? '0.5px solid #d1d5db'
                : '1px dashed #9ca3af',

            background:
              '#ffffff',

            boxSizing:
              'border-box',

            overflow:
              'hidden',
          }}
        >
          <div
            style={{
              transform:
                `scale(${previewScale / 3.7795275591})`,

              transformOrigin:
                'top left',

              width:
                `${A4_STICKER_CONFIG.stickerWidthMm * 3.7795275591}px`,

              height:
                `${A4_STICKER_CONFIG.stickerHeightMm * 3.7795275591}px`,

              position:
                'relative',
            }}
          >
            <StickerContent
              {...stickerContentProps}
              stickerKey={`pv-s-${s}`}
              showBorder={false}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          width:
            `${pageW}px`,

          height:
            `${pageH}px`,

          position:
            'relative',

          background:
            '#ffffff',

          border:
            '1px solid #e5e7eb',

          boxShadow:
            '0 1px 3px rgba(0,0,0,0.05)',

          flexShrink: 0,

          overflow:
            'hidden',
        }}
      >
        {previewStickers}
      </div>
    );
  };

  /**
   * ============================================================
   * RENDER
   * ============================================================
   */
  return (
    <div className="modal-overlay">
      <div className="modal max-w-3xl">

        {/* ======================================================
            HEADER
        ====================================================== */}
        <div className="modal-header no-print">
          <h2 className="text-xl font-bold text-gray-900">
            Print Barcode Sticker
          </h2>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ======================================================
            BODY
        ====================================================== */}
        <div className="modal-body space-y-6">

          {/* ====================================================
              PRODUCT + MODE
          ==================================================== */}
          <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* PRODUCT INFO */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Sticker Info
              </h3>

              <div className="space-y-2 text-sm">

                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">
                    Product:
                  </span>

                  <span className="font-medium text-gray-900 text-right">
                    {productName}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">
                    SKU:
                  </span>

                  <span className="font-mono text-gray-900">
                    {product.sku}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">
                    Barcode:
                  </span>

                  <span className="font-mono text-gray-900">
                    {barcodeValue}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">
                    Price:
                  </span>

                  <span className="font-semibold text-gray-900">
                    {formatPrice(
                      priceValue
                    )}
                  </span>
                </div>

              </div>
            </div>

            {/* PRINT OPTIONS */}
            <div className="space-y-4">

              {/* PRINT MODE */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Print Mode
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

                  {/* THERMAL 38 */}
                  <button
                    onClick={() =>
                      setMode('thermal')
                    }
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

                  {/* THERMAL 50 */}
                  <button
                    onClick={() =>
                      setMode('thermal50')
                    }
                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition ${
                      mode === 'thermal50'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    🖨️ Thermal Roll

                    <div className="text-xs font-normal mt-0.5 opacity-80">
                      50×25mm · Xprinter
                    </div>
                  </button>

                  {/* A4 */}
                  <button
                    onClick={() =>
                      setMode('a4grid')
                    }
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

              {/* NUMBER OF STICKERS */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Stickers
                </label>

                <div className="flex items-center space-x-3">

                  <button
                    onClick={() =>
                      setCopies(
                        (c) =>
                          Math.max(
                            1,
                            c - 1
                          )
                      )
                    }
                    className="btn btn-secondary btn-md"
                    disabled={copies <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="text-lg font-bold text-gray-900 w-16 text-center">
                    {copies}
                  </span>

                  <button
                    onClick={() =>
                      setCopies(
                        (c) =>
                          Math.min(
                            500,
                            c + 1
                          )
                      )
                    }
                    className="btn btn-secondary btn-md"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() =>
                      setCopies(32)
                    }
                    className="btn btn-secondary btn-sm text-xs"
                  >
                    32
                  </button>

                  <button
                    onClick={() =>
                      setCopies(
                        stickersPerPage
                      )
                    }
                    className="btn btn-secondary btn-sm text-xs"
                  >
                    Full Sheet
                  </button>

                </div>

                <p className="text-xs text-gray-500 mt-2">

                  {mode === 'a4grid'
                    ? `A4 (${A4_GRID_CONFIG.pageWidthMm}×${A4_GRID_CONFIG.pageHeightMm}mm) · Grid: ${A4_GRID_CONFIG.columns}×${A4_GRID_CONFIG.rows} = ${stickersPerPage} stickers/page · Column-major`
                    : `Sticker: ${stickerConfig.stickerWidthMm}×${stickerConfig.stickerHeightMm}mm · ${rollConfig.stickerOffsetLeftMm > 0 ? 'Centered' : 'Left-aligned'} on ${rollConfig.mediaWidthMm}mm printer path`}

                  {mode === 'a4grid' &&
                    copies > 0 && (
                      <span className="ml-2 font-medium">
                        · Pages:{' '}
                        {totalPages}
                      </span>
                    )}

                </p>
              </div>

            </div>
          </div>

          {/* ====================================================
              PREVIEW
          ==================================================== */}
          <div className="no-print">

            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Preview
            </h3>

            <div className="flex justify-center p-6 bg-gray-100 rounded-2xl border border-gray-200 overflow-auto">
              {renderPreview()}
            </div>

          </div>

        </div>

        {/* ======================================================
            HIDDEN PRINT CONTENT
        ====================================================== */}
        <div
          id="barcode-sticker-sheet"
          style={{
            display: 'none',
          }}
        >
          {mode !== 'a4grid'
            ? renderThermalSheet()
            : renderA4GridSheet()}
        </div>

        {/* ======================================================
            FOOTER
        ====================================================== */}
        <div className="modal-footer no-print">

          <button
            onClick={onClose}
            className="btn btn-secondary btn-md"
          >
            Close
          </button>

          <button
            onClick={handlePrint}
            className="btn btn-primary btn-md"
            disabled={!barcodeValue}
          >
            <Printer className="h-4 w-4 mr-2" />

            Print{' '}

            {copies > 1
              ? `${copies} Stickers`
              : 'Sticker'}

            {mode === 'a4grid' &&
              totalPages > 1 &&
              ` · ${totalPages} Pages`}
          </button>

        </div>

        {/* ======================================================
            PRINT CSS
        ====================================================== */}
        <style>{`

          /* ====================================================
             GLOBAL PRINT PAGE DEFINITIONS
          ==================================================== */

          @page {
            margin: 0;
          }

          /*
           * Thermal page.
           *
           * 80mm roll width.
           */
          @page thermal {
            size: 80mm auto;
            margin: 0;
          }

          @page thermal50 {
            size: 80mm auto;
            margin: 0;
          }

          /*
           * A4 page.
           */
          @page a4grid {
            size: A4 portrait;
            margin: 0;
          }


          /* ====================================================
             PRINT MEDIA
          ==================================================== */

          @media print {

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;

              width: auto !important;
              height: auto !important;

              background: #ffffff !important;

              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }


            /*
             * Hide application UI.
             */
            .no-print {
              display: none !important;
            }


            /*
             * Hide all existing body children.
             */
            .print-body-hidden {
              display: none !important;
            }


            /*
             * Show cloned print root.
             */
            .print-body-visible {
              display: block !important;
              visibility: visible !important;
            }


            /* ==================================================
               IMPORTANT:
               DO NOT FORCE display:block on ALL CHILDREN.
               
               The old code had:
               
               #barcode-sticker-print-root * {
                 display:block !important;
               }
               
               That breaks flex alignment inside StickerContent.
               ================================================== */

            #barcode-sticker-print-root,
            #barcode-sticker-print-root * {
              visibility: visible !important;
            }


            /* ==================================================
               PRINT ROOT
            ================================================== */

            #barcode-sticker-print-root {
              position: absolute !important;

              left: 0 !important;
              top: 0 !important;

              margin: 0 !important;
              padding: 0 !important;

              background: #ffffff !important;

              box-sizing: border-box !important;

              visibility: visible !important;
            }


            /* ==================================================
               THERMAL / XPRINTER
            ================================================== */

            #barcode-sticker-print-root[data-print-mode="thermal"],
            #barcode-sticker-print-root[data-print-mode="thermal50"] {
              page: thermal !important;

              width: 80mm !important;
              height: auto !important;

              margin: 0 !important;
              padding: 0 !important;

              box-sizing: border-box !important;
            }

            #barcode-sticker-print-root[data-print-mode="thermal50"] {
              page: thermal50 !important;
            }


            /*
             * Thermal roll wrapper.
             */
            #barcode-sticker-print-root[data-print-mode="thermal"] > div,
            #barcode-sticker-print-root[data-print-mode="thermal50"] > div {
              width: 80mm !important;
              height: auto !important;

              margin: 0 !important;
              padding: 0 !important;

              position: relative !important;

              overflow: hidden !important;

              box-sizing: border-box !important;

              background: #ffffff !important;
            }


            /*
             * Prevent any unexpected margins
             * inside thermal print root.
             */
            #barcode-sticker-print-root[data-print-mode="thermal"] div,
            #barcode-sticker-print-root[data-print-mode="thermal50"] div {
              box-sizing: border-box;
            }


            /* ==================================================
               A4 GRID
            ================================================== */

            #barcode-sticker-print-root[data-print-mode="a4grid"] {
              page: a4grid !important;

              width: 210mm !important;
              height: auto !important;

              margin: 0 !important;
              padding: 0 !important;

              box-sizing: border-box !important;
            }


            /*
             * Each A4 page.
             */
            #barcode-sticker-print-root[data-print-mode="a4grid"] > div {
              width: 210mm !important;
              height: 297mm !important;

              margin: 0 !important;
              padding: 0 !important;

              position: relative !important;

              overflow: hidden !important;

              box-sizing: border-box !important;

              background: #ffffff !important;
            }


            /*
             * Remove browser-added margins from
             * direct printed children.
             */
            #barcode-sticker-print-root > div {
              margin: 0 !important;
              padding: 0 !important;
            }


            /*
             * SVG barcode must retain its dimensions.
             */
            #barcode-sticker-print-root svg {
              display: block !important;

              max-width: none !important;
              max-height: none !important;
            }

          }

        `}</style>

      </div>
    </div>
  );
}


/**
 * ============================================================
 * STICKER CONTENT PROPS
 * ============================================================
 */
interface StickerContentProps {
  companyName: string;
  productName: string;
  priceText: string;
  barcodeValue: string;

  companyNameFontSize: number;
  productNameFontSize: number;
  priceFontSize: number;
  barcodeNumberFontSize: number;

  cn: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  pn: {
    x: number;
    y: number;
    width: number;
    height: number;
    lines: number;
  };

  pr: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  bc: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  bn: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  stickerKey: string;

  showBarcodeNumber?: boolean;
  showBorder?: boolean;
  leftAlignContent?: boolean;
}


/**
 * ============================================================
 * STICKER CONTENT
 * ============================================================
 */
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

  showBarcodeNumber = true,
  showBorder = false,
  leftAlignContent = false,
}: StickerContentProps) {

  const inlineBarcodeSvgRef =
    useRef<SVGSVGElement>(null);

  /**
   * Normalize barcode for Code 128 rendering.
   */
  const normalizedBarcodeValue =
    useMemo(
      () =>
        normalizeCode128Value(
          barcodeValue
        ),
      [barcodeValue]
    );

  /**
   * Unique rendering key.
   */
  const key =
    `${stickerKey}-${normalizedBarcodeValue}-${bc.width}-${bc.height}`;


  /**
   * ==========================================================
   * RENDER BARCODE
   * ==========================================================
   */
  useEffect(() => {

    if (
      !inlineBarcodeSvgRef.current ||
      !normalizedBarcodeValue
    ) {
      return;
    }

    const svg =
      inlineBarcodeSvgRef.current;

    /**
     * Convert mm to CSS px at 96 DPI.
     */
    const widthPx =
      (bc.width / 25.4) * 96;

    const heightPx =
      (bc.height / 25.4) * 96;

    /**
     * SVG dimensions.
     */
    svg.setAttribute(
      'width',
      '100%'
    );

    svg.setAttribute(
      'height',
      '100%'
    );

    svg.setAttribute(
      'viewBox',
      `0 0 ${widthPx} ${heightPx}`
    );

    /**
     * IMPORTANT:
     *
     * preserveAspectRatio="none"
     *
     * keeps barcode inside the exact
     * calculated box.
     */
    svg.setAttribute(
      'preserveAspectRatio',
      'none'
    );

    /**
     * Clear old barcode.
     */
    svg.innerHTML = '';

    try {

      renderBarcodeToSvg(
        svg,
        normalizedBarcodeValue,
        {
          format: 'CODE128',

          width: Math.max(
            1,
            Math.floor(widthPx / 180)
          ),

          height: heightPx,

          displayValue: false,

          margin: 0,

          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,

          background:
            '#ffffff',

          lineColor:
            '#000000',
        }
      );

    } catch (error) {

      console.error(
        'Barcode render error:',
        error
      );

    }

  }, [
    key,
    normalizedBarcodeValue,
    bc.width,
    bc.height,
  ]);


  /**
   * ==========================================================
   * STICKER ROOT
   * ==========================================================
   */
  return (
    <div
      style={{
        position:
          'absolute',

        left: 0,
        top: 0,

        width:
          '100%',

        height:
          '100%',

        overflow:
          'hidden',

        background:
          '#ffffff',

        fontFamily:
          "'Inter', Arial, Helvetica, sans-serif",

        color:
          '#000000',

        border:
          showBorder
            ? '0.1mm solid #9ca3af'
            : 'none',

        boxSizing:
          'border-box',
      }}
    >

      {/* ====================================================
          COMPANY NAME
      ==================================================== */}
      <div
        style={{
          position:
            'absolute',

          left:
            mm(cn.x),

          top:
            mm(cn.y),

          width:
            mm(cn.width),

          height:
            mm(cn.height),

          display:
            'flex',

          alignItems:
            'center',

          justifyContent:
            leftAlignContent
              ? 'flex-start'
              : 'center',

          textAlign:
            leftAlignContent
              ? 'left'
              : 'center',

          fontSize:
            `${companyNameFontSize}pt`,

          fontWeight:
            700,

          lineHeight:
            1.1,

          letterSpacing:
            '0.02em',

          overflow:
            'hidden',

          whiteSpace:
            'nowrap',

          textOverflow:
            'ellipsis',

          boxSizing:
            'border-box',
        }}
      >
        {companyName}
      </div>


      {/* ====================================================
          PRODUCT NAME
      ==================================================== */}
      <div
        style={{
          position:
            'absolute',

          left:
            mm(pn.x),

          top:
            mm(pn.y),

          width:
            mm(pn.width),

          height:
            mm(pn.height),

          display:
            'flex',

          alignItems:
            'center',

          justifyContent:
            leftAlignContent
              ? 'flex-start'
              : 'center',

          textAlign:
            leftAlignContent
              ? 'left'
              : 'center',

          fontSize:
            `${productNameFontSize}pt`,

          fontWeight:
            600,

          lineHeight:
            1.15,

          overflow:
            'hidden',

          wordBreak:
            'break-word',

          hyphens:
            'auto',

          boxSizing:
            'border-box',

          padding:
            0,

          margin:
            0,
        }}
      >
        {productName}
      </div>


      {/* ====================================================
          PRICE
      ==================================================== */}
      <div
        style={{
          position:
            'absolute',

          left:
            mm(pr.x),

          top:
            mm(pr.y),

          width:
            mm(pr.width),

          height:
            mm(pr.height),

          display:
            'flex',

          alignItems:
            'center',

          justifyContent:
            leftAlignContent
              ? 'flex-start'
              : 'center',

          textAlign:
            leftAlignContent
              ? 'left'
              : 'center',

          fontSize:
            `${priceFontSize}pt`,

          fontWeight:
            800,

          lineHeight:
            1,

          letterSpacing:
            '0.01em',

          overflow:
            'hidden',

          whiteSpace:
            'nowrap',

          boxSizing:
            'border-box',

          padding:
            0,

          margin:
            0,
        }}
      >
        {priceText}
      </div>


      {/* ====================================================
          BARCODE
      ==================================================== */}
      <div
        style={{
          position:
            'absolute',

          left:
            mm(bc.x),

          top:
            mm(bc.y),

          width:
            mm(bc.width),

          height:
            mm(bc.height),

          background:
            '#ffffff',

          overflow:
            'hidden',

          boxSizing:
            'border-box',

          padding:
            0,

          margin:
            0,
        }}
      >
        <svg
          ref={
            inlineBarcodeSvgRef
          }
          style={{
            width:
              '100%',

            height:
              '100%',

            display:
              'block',

            margin:
              0,

            padding:
              0,
          }}
        />
      </div>


      {showBarcodeNumber && (
        <div
          style={{
            position:
              'absolute',

            left:
              mm(bn.x),

            top:
              mm(bn.y),

            width:
              mm(bn.width),

            height:
              mm(bn.height),

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              leftAlignContent
                ? 'flex-start'
                : 'center',

            textAlign:
              leftAlignContent
                ? 'left'
                : 'center',

            fontSize:
              `${barcodeNumberFontSize}pt`,

            fontWeight:
              600,

            lineHeight:
              1,

            fontFamily:
              "'Courier New', monospace",

            letterSpacing:
              '0.08em',

            overflow:
              'hidden',

            whiteSpace:
              'nowrap',

            boxSizing:
              'border-box',

            padding:
              0,

            margin:
              0,
          }}
        >
          {normalizedBarcodeValue}
        </div>
      )}

    </div>
  );
}
