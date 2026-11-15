# @titan/test-framework

## Responsibilities

Owns general test utilities independent of product behavior: captured failures and temporary filesystem scopes.

## Public contract

The root export provides `thrownBy`, `processExited` and `waitUntil`. Process observation accepts only an absent process as exited; a permission error does not establish exit. Waiting uses a finite attempt budget with asynchronous delays. Its optional third argument selects the delay in milliseconds; the default stays ten. Mixed SDK workflow observation uses 200 attempts at fifty milliseconds, preserving the former ten-second delay budget while reducing repeated HTTP reads. The caller still owns its test deadline. `withProcessDeadline(child, milliseconds, action)` owns an already started child for one action. It validates a positive integer deadline of at most thirty seconds, kills the child at expiry and always kills and awaits exit during cleanup, including invalid input and action failure. It returns the action result; callers must inspect exit status and bound output reads. `./files` provides generic `withTemporaryDirectory`, which returns the action result and removes its directory in a finally block.

## Verification

Run the complete offline suite and type checking. Hook, workspace and configuration fixtures exercise success and exception cleanup and preserve typed results. Process-scope cases use actual children for ordinary completion, deadline termination, thrown actions and invalid deadlines, and require observed exit.

## Limits

Helpers must not hide test failures or manufacture passing assertions. Product-specific setup belongs to testing factories rather than this general utility package.
