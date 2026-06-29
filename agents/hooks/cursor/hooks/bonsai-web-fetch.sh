#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

node -e '
const fs = require("node:fs");
const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const raw = JSON.stringify(input.tool_input ?? input.toolArgs ?? input);
const match = raw.match(/https?:\/\/[^\s"'\''<>)}\]]+/);
const url = match ? match[0] : "<url>";
const command = `npx @taurgis/bonsai ${url} --format detailed`;
const message =
  `Use Bonsai instead of the native URL fetch so the result is cached and reusable. Run: ${command}`;
process.stdout.write(JSON.stringify({
  continue: true,
  permission: "deny",
  user_message: "Native web fetch blocked. Use Bonsai for reusable research cache entries.",
  agent_message: message
}) + "\n");
' <<< "$input"
