#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

node -e '
const fs = require("node:fs");
const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const raw = JSON.stringify(input.tool_input ?? input);
const match = raw.match(/https?:\/\/[^\s"'\''<>)}\]]+/);
const url = match ? match[0] : "<url>";
const command = `bonsai ${url} --format detailed`;
const reason =
  `Use Bonsai instead of the native web fetch so the result is cached and reusable. Run: ${command}`;
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason
  }
}) + "\n");
' <<< "$input"
