# @titan/errors

## Responsibilities

Owns typed input and operational failures, safe error-message extraction and conservative classification of unknown backend failures.

## Public contract

`TitanError` carries a code and process exit code. `OperationalError` adds retryability and retry delay. `classifyError` preserves operational errors and classifies unknown failures as execution interruptions.

## Verification

Run the offline backend and recovery suites. Operational failures must block or retry the same logical attempt; they must never become a falsifier verdict.

## Limits

Unknown vendor failures are not automatically retryable. Adapter-specific classification and real SDK transport validation remain required before production acceptance.
