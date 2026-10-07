export const CURRENCY_SYMBOL = '₹';

export function formatINR(amountInPaise: number): string {
  return `₹${(amountInPaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
