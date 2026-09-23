import { DEFAULT_PRICE_RANGES, PriceRange } from '../types';

export function getPriceRange(cost: number, ranges?: PriceRange[]): PriceRange | undefined {
  return (ranges || DEFAULT_PRICE_RANGES).find(({ minCost, maxCost }) =>
    cost >= minCost && (maxCost === undefined || cost < maxCost)
  );
}

export function getRangeDiscountPercentage(cost: number, ranges?: PriceRange[]): number {
  return getPriceRange(cost, ranges)?.discountPercentage || 0;
}