---
topic: CDP Runtime.evaluate parameter shape returnByValue awaitPromise
slug: cdp-runtime-evaluate
tier: stable
sources:
  - https://chromedevtools.github.io/devtools-protocol/tot/Runtime/
fetched_at: 2026-06-24T00:00:00Z
validated_at: 2026-06-24T00:00:00Z
source_version: Chrome DevTools Protocol (tip-of-tree)
status: active
---

# CDP Runtime.evaluate

Source: https://chromedevtools.github.io/devtools-protocol/tot/Runtime/

## Method: Runtime.evaluate

Evaluates an expression in the global context of the inspected page.

### Parameters

Required:
- `expression` (string) — JavaScript expression to evaluate

Optional:
- `objectGroup` (string) — symbolic group name for the result object; allows bulk release via releaseObjectGroup
- `includeCommandLineAPI` (boolean) — whether to make the Command Line API available during evaluation
- `silent` (boolean) — if true, exceptions during evaluation are not reported and do not pause execution
- `contextId` (ExecutionContextId) — specifies which execution context to use; if omitted, uses the inspected page's default context
- `returnByValue` (boolean) — if true, the result is expected to be a JSON-serializable value and is returned by value (as JSON), not by reference; the result RemoteObject's `value` field will be populated
- `generatePreview` (boolean) — whether a preview should be generated for the result
- `userGesture` (boolean) — whether to treat the evaluation as being triggered by user gesture
- `awaitPromise` (boolean) — if true, the CDP client awaits the returned Promise's resolution before sending the response; the resolved value is returned, not the Promise object itself
- `throwOnSideEffect` (boolean) — whether to throw if evaluation could have side effects
- `timeout` (TimeDelta) — maximum time in milliseconds to evaluate; if exceeded, execution is terminated and a Timeout exception is thrown
- `disableBreaks` (boolean) — whether to disable breakpoints during execution
- `replMode` (boolean) — setting this to true lets Runtime treat the evaluated expression as REPL
- `allowUnsafeEvalBlockedByCSP` (boolean) — whether to override Content-Security-Policy that blocks eval
- `uniqueContextId` (string) — alternative to contextId for identifying execution context by unique id string
- `serializationOptions` (SerializationOptions) — overrides both generatePreview and returnByValue when specified

### Return value

- `result` (RemoteObject, required) — evaluation result; when returnByValue is true, `result.value` contains the JSON-deserialized value
- `exceptionDetails` (ExceptionDetails, optional) — present only when an exception was thrown during evaluation

### returnByValue behavior

When `returnByValue: true`:
- The expression must evaluate to a JSON-serializable value (primitives, plain objects, arrays)
- The result comes back in `result.value` directly in the CDP response
- Non-serializable values (DOM nodes, functions, circular references) will throw a "Object couldn't be cloned" error

### awaitPromise behavior

When `awaitPromise: true`:
- The CDP call blocks until the Promise resolves or rejects
- The resolved value is returned in `result`
- If the promise rejects, `exceptionDetails` is populated
- Works together with `returnByValue`: you can combine both to get a resolved promise's JSON value directly
