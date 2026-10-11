export const DEFAULT_GHOST_COIN_PKR_VALUE = 10;

/** Canonical business value: one Ghost Coin is worth exactly 10 PKR. */
export function getGhostCoinPkrValue() {
  const value = Number(process.env.GHOST_COIN_PKR_VALUE);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_GHOST_COIN_PKR_VALUE;
}
