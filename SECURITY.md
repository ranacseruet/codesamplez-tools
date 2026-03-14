# Security Policy

## Supported Versions

Security fixes are applied to:

- The current `main` branch
- The latest deployed static site artifacts derived from `main`

Older branches, historical snapshots, and archived planning documents are not supported for security updates.

## Reporting A Vulnerability

Please use GitHub private vulnerability reporting for this repository to disclose suspected security issues.

- Do not open public GitHub issues for vulnerability reports.
- Include the affected tool or surface, reproduction steps, impact, and any suggested fix or mitigation.
- If a proof of concept is needed, keep it minimal and avoid exposing real secrets or user data.

If GitHub private vulnerability reporting is not yet enabled for the repository, treat that as a launch blocker and wait for it to be enabled rather than filing a public report.

## Response Expectations

The maintainer will aim to:

- Acknowledge valid reports promptly
- Reproduce and assess impact
- Prepare a fix on the supported branch or deployment path
- Coordinate disclosure timing through GitHub's security workflow

## Scope Notes

The project is a collection of client-side developer tools. Reports are most useful when they focus on:

- Client-side injection or parsing vulnerabilities
- Build pipeline or supply-chain issues that affect published artifacts
- Privacy or data-handling regressions
- Dependency vulnerabilities with a plausible path into production or contributor workflows
