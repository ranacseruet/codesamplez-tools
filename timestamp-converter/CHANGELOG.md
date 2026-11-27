# Changelog

All notable changes to this tool are documented in this file.

## [1.0.1] - 2026-11-27

### Unix Timestamp Converter

- The converter is a live clock and a two-column workbench. Epoch, date, and JWT are a mode switch, and the unit is a segmented control. The result stays beside the form, each value can be copied, and the time updates as you type. Conversion still runs in the browser.

## [1.0.0] - 2026-11-26

### Unix Timestamp Converter

- Convert epoch seconds, milliseconds, microseconds, and nanoseconds to UTC, local time, and a chosen IANA time zone, and convert a date back to epoch. A JWT exp, iat, or nbf value is read as seconds. Conversion runs in the browser. A tool_used event records the action, trigger, and outcome only. The timestamp and the time zone name are not sent.
