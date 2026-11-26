# Changelog

All notable changes to this tool are documented in this file.

## [1.0.0] - 2026-11-26

### Unix Timestamp Converter

- Convert epoch seconds, milliseconds, microseconds, and nanoseconds to UTC, local time, and a chosen IANA time zone, and convert a date back to epoch. A JWT exp, iat, or nbf value is read as seconds. Conversion runs in the browser. A tool_used event records the action, trigger, and outcome only. The timestamp and the time zone name are not sent.
