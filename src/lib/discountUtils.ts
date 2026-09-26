export function getPercentageDiscountAmount(amount: number, percentage: number): number {
  if (percentage <= 0) return 0;

  const discountedAmount = amount * (1 - percentage / 100);
  return amount - Math.round(discountedAmount / 10) * 10;
}