#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

node -e '
const fs = require("node:fs");
const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const prompt = String(input.prompt ?? "");
if (!/https?:\/\/\S+/.test(prompt)) process.exit(0);
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext:
      "When fetching documentation or URL content for this prompt, use Bonsai first: npx @taurgis/bonsai <url> --format detailed. Use --rendered only when static extraction is incomplete."
  }
}) + "\n");
' <<< "$input"
