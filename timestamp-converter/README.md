# Unix Timestamp Converter

Convert a Unix timestamp to a calendar time, or a calendar time back to epoch, in the browser.

## Features

- Current Unix seconds, updated once a second
- Seconds, milliseconds, microseconds, and nanoseconds, chosen from the digit count or forced from the unit menu
- UTC, the browser's local zone, and an IANA time zone you type
- ISO 8601, RFC 2822, and a relative time
- Date and time in that zone back to epoch
- A JWT exp, iat, or nbf field that always reads seconds

## Usage

1. Paste a timestamp, or click Use this time.
2. Leave the unit on Auto, or pick one.
3. Type an IANA time zone, such as `UTC` or `America/New_York`.
4. Click Convert timestamp.
5. To go the other way, enter a date and time and click Convert date.
6. For a JWT claim, paste the number into JWT exp / iat. That field does not switch units by digit count.

## Notes

The integer is kept as nanoseconds, so a current nanosecond count stays exact. Calendar lines use the millisecond instant. The ISO 8601 line keeps finer digits. RFC 2822 is whole seconds. Leap seconds are not applied. A spring-forward gap is rejected. When a local time happens twice, the earlier instant is kept. Nothing you type is uploaded, and the `tool_used` event does not include the timestamp or the time zone name.
