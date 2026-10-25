export const DEFAULT_GHOST_COIN_USD_VALUE = 0.036;

/** Canonical business value: one Ghost Coin is worth exactly $0.036 USD. */
export function getGhostCoinUsdValue() {
  const value = Number(process.env.GHOST_COIN_USD_VALUE);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_GHOST_COIN_USD_VALUE;
}
