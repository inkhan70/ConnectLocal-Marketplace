# Ghost Coin Rewards

## New flow

1. Seller opens the seller dashboard and enables a Ghost Coin offer.
2. Seller chooses `coins per completed sale` and an optional minimum item quantity.
3. At checkout, the server snapshots that offer into the order.
4. The buyer sees Ghost Coins in the buyer dashboard.
5. Ghost Coins are credited only after seller-delivery confirmation or verified pickup completes the order.
6. The server marks the order as rewarded so retries cannot issue the same reward twice.
7. Buyer conversion is server-authoritative; the browser cannot directly change `ghostCoins` or `balance`.

## Example

A seller can configure:
- Minimum quantity: `1000`
- Reward: `5` Ghost Coins
- Offer: enabled

A completed order containing at least 1000 items from that seller earns 5 Ghost Coins. The 5-coin amount is locked at checkout.

## Coin value and local currency

The canonical business value is **1 Ghost Coin = 10 PKR**. This PKR value does not change when foreign exchange rates move.

For display/conversion in another currency, the server uses the current configured USD/PKR rate as the bridge and then converts PKR into the buyer's currency:

`Ghost Coins × 10 PKR → USD using current USD/PKR → buyer's local currency`

For example, if 1 USD = 277.07 PKR, then 1 Ghost Coin is approximately **$0.0361 USD**. The exact displayed value can change as the configured FX rate changes, while the underlying coin value remains 10 PKR.

Conversion is account credit inside the marketplace, not external cash withdrawal.

## Important production note

The exchange-rate values in `.env.example` are example configuration values, not live market rates. Production should use reviewed/current rates or an approved FX provider before enabling conversion.

## IP-based local currency display

Ghost Coin value is fixed at **10 PKR per coin**. The buyer dashboard does not trust a browser-selected currency. On each reward-rate request, the server detects the user's public IP using trusted hosting headers when available, otherwise IP geolocation is resolved server-side. The detected country/currency is then used for display.

Conversion path:

`Ghost Coins × 10 PKR → PKR → USD → IP-detected local currency`

The FX layer uses ExchangeRate-API's open USD rate endpoint and caches the returned rate set until its advertised next update. The open endpoint is intended for low-volume use and requires attribution; production deployments with higher volume should use an approved commercial FX provider or a controlled cached rate service.
