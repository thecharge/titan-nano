# @titan/messages

## Responsibilities

Owns user diagnostics, generated guide text and message formatters. Domain modules keep wording separate from orchestration and protocol identifiers.

## Public contract

Import messages and formatters from the root export. Pass already validated identifiers and safe diagnostic data. Error codes belong to constants; exception classes belong to errors.

## Verification

Run the offline suites and documentation checks. CLI and transport cases assert meaningful diagnostic outcomes; secret tests verify that credential values do not enter later diagnostics.

## Limits

A message is not an error classification or a security boundary. Callers must avoid sending secrets to formatters. Guide text describes the experimental delivery limits. The installed skill wraps this canonical body with YAML frontmatter; shared installation cases validate the header, compile its example and check current command availability.
