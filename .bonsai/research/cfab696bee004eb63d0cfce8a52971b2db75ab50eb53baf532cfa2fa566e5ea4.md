---
schema_version: 1
artifact_type: section
source_url: https://nodejs.org/api/child_process.html#advanced-serialization
source_urls:
  - https://nodejs.org/api/child_process.html#advanced-serialization
normalized_url: https://nodejs.org/api/child_process.html
cache_key: cfab696bee004eb63d0cfce8a52971b2db75ab50eb53baf532cfa2fa566e5ea4
topic: Node child_process detached/kill process groups
tags:
  - nodejs
  - child_process
format_available:
  - compressed
  - detailed
tier: standard
ttl: 
fetched_at: 2026-07-22T19:46:09.910Z
validated_at: 2026-07-22T19:46:09.910Z
stale_after: 2026-08-21T19:46:09.910Z
capture_method: route_markdown
extraction_status: extracted
extraction_confidence: high
quality_notes:
  - captured from public Markdown/MDX source: https://nodejs.org/api/child_process.md
supplied_at: 
supplied_by: 
etag: W/"abc71a5136faee97cef60f9092087a53"
last_modified: Wed, 08 Jul 2026 00:43:19 GMT
content_hash: 9d3c51a62fb59dd95e651accd630909100f9427aa4a47e1fab8cdd476d69bcc1
token_estimate:
  compressed: 675
  detailed: 791
status: active
site_module_id: 
docs_engine: generated-static
docs_framework: 
source_doc_url: https://nodejs.org/api/child_process.md
search_provider: 
parent_cache_key: bb70392644cf3165645bed392e602dcc7fd929108ed925fe7044cff6f70d49e2
section_anchor: advanced-serialization
section_heading_path: Child process > Advanced serialization
---

## Summary

Child process > Advanced serialization

## Compressed

## Advanced serialization

<!-- YAML
added:
 - v13.2.0
 - v12.16.0
-->

Child processes support a serialization mechanism for IPC that is based on the [serialization API of the `node:v8` module][v8.serdes], based on the [HTML structured clone algorithm][].

However, this format is not a full superset of JSON, and e.g. properties set on objects of such built-in types will not be passed on through the serialization step.

[Advanced serialization]: #advanced-serialization [DEP0190]: deprecations.md#DEP0190 [Default Windows shell]: #default-windows-shell [HTML structured clone algorithm]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm [Shell requirements]: #shell-requirements [Signal Events]: process.md#signal-events [`'disconnect'`]: process.md#event-disconnect [`'error'`]: #event-error [`'exit'`]: #event-exit [`'message'`]: process.md#event-message [`ChildProcess`]: #class-childprocess [`Error`]: errors.md#class-error [`EventEmitter`]: events.md#class-eventemitter [`child_process.exec()`]: #child_processexeccommand-options-callback [`child_process.execFile()`]: #child_processexecfilefile-args-options-callback [`child_process.execFileSync()`]: #child_processexecfilesyncfile-args-options [`child_process.execSync()`]: #child_processexecsynccommand-options [`child_process.fork()`]: #child_processforkmodulepath-args-options [`child_process.spawn()`]: #child_processspawncommand-args-options [`child_process.spawnSync()`]: #child_processspawnsynccommand-args-options [`dgram.Socket`]: dgram.md#class-dgramsocket [`maxBuffer` and Unicode]: #maxbuffer-and-unicode [`net.Server`]: net.md#class-netserver [`net.Socket`]: net.md#class-netsocket [`options.detached`]: #optionsdetached [`process.disconnect()`]: process.md#processdisconnect [`process.env`]: process.md#processenv [`process.execPath`]: process.md#processexecpath [`process.send()`]: process.md#processsendmessage-sendhandle-options-callback [`stdio`]: #optionsstdio [`subprocess.connected`]: #subprocessconnected [`subprocess.disconnect()`]: #subprocessdisconnect [`subprocess.exitCode`]: #subprocessexitcode [`subprocess.kill()`]: #subprocesskillsignal [`subprocess.send()`]: #subprocesssendmessage-sendhandle-options-callback [`subprocess.signalCode`]: #subprocesssignalcode [`subprocess.stderr`]: #subprocessstderr [`subprocess.stdin`]: #subprocessstdin [`subprocess.stdio`]: #subprocessstdio [`subprocess.stdout`]: #subprocessstdout [`util.convertProcessSignalToExitCode()`]: util.md#utilconvertprocesssignaltoexitcodesignalcode [`util.promisify()`]: util.md#utilpromisifyoriginal [synchronous counterparts]: #synchronous-process-creation [v8.serdes]: v8.md#serialization-api

## Detailed

## Advanced serialization

<!-- YAML
added:
 - v13.2.0
 - v12.16.0
-->

Child processes support a serialization mechanism for IPC that is based on the
[serialization API of the `node:v8` module][v8.serdes], based on the
[HTML structured clone algorithm][]. This is generally more powerful and
supports more built-in JavaScript object types, such as `BigInt`, `Map`
and `Set`, `ArrayBuffer` and `TypedArray`, `Buffer`, `Error`, `RegExp` etc.

However, this format is not a full superset of JSON, and e.g. properties set on
objects of such built-in types will not be passed on through the serialization
step. Additionally, performance may not be equivalent to that of JSON, depending
on the structure of the passed data.
Therefore, this feature requires opting in by setting the
`serialization` option to `'advanced'` when calling [`child_process.spawn()`][]
or [`child_process.fork()`][].

[Advanced serialization]: #advanced-serialization
[DEP0190]: deprecations.md#DEP0190
[Default Windows shell]: #default-windows-shell
[HTML structured clone algorithm]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
[Shell requirements]: #shell-requirements
[Signal Events]: process.md#signal-events
[`'disconnect'`]: process.md#event-disconnect
[`'error'`]: #event-error
[`'exit'`]: #event-exit
[`'message'`]: process.md#event-message
[`ChildProcess`]: #class-childprocess
[`Error`]: errors.md#class-error
[`EventEmitter`]: events.md#class-eventemitter
[`child_process.exec()`]: #child_processexeccommand-options-callback
[`child_process.execFile()`]: #child_processexecfilefile-args-options-callback
[`child_process.execFileSync()`]: #child_processexecfilesyncfile-args-options
[`child_process.execSync()`]: #child_processexecsynccommand-options
[`child_process.fork()`]: #child_processforkmodulepath-args-options
[`child_process.spawn()`]: #child_processspawncommand-args-options
[`child_process.spawnSync()`]: #child_processspawnsynccommand-args-options
[`dgram.Socket`]: dgram.md#class-dgramsocket
[`maxBuffer` and Unicode]: #maxbuffer-and-unicode
[`net.Server`]: net.md#class-netserver
[`net.Socket`]: net.md#class-netsocket
[`options.detached`]: #optionsdetached
[`process.disconnect()`]: process.md#processdisconnect
[`process.env`]: process.md#processenv
[`process.execPath`]: process.md#processexecpath
[`process.send()`]: process.md#processsendmessage-sendhandle-options-callback
[`stdio`]: #optionsstdio
[`subprocess.connected`]: #subprocessconnected
[`subprocess.disconnect()`]: #subprocessdisconnect
[`subprocess.exitCode`]: #subprocessexitcode
[`subprocess.kill()`]: #subprocesskillsignal
[`subprocess.send()`]: #subprocesssendmessage-sendhandle-options-callback
[`subprocess.signalCode`]: #subprocesssignalcode
[`subprocess.stderr`]: #subprocessstderr
[`subprocess.stdin`]: #subprocessstdin
[`subprocess.stdio`]: #subprocessstdio
[`subprocess.stdout`]: #subprocessstdout
[`util.convertProcessSignalToExitCode()`]: util.md#utilconvertprocesssignaltoexitcodesignalcode
[`util.promisify()`]: util.md#utilpromisifyoriginal
[synchronous counterparts]: #synchronous-process-creation
[v8.serdes]: v8.md#serialization-api

## Provenance

Section "Child process > Advanced serialization" of https://nodejs.org/api/child_process.html (parent bb70392644cf3165645bed392e602dcc7fd929108ed925fe7044cff6f70d49e2)