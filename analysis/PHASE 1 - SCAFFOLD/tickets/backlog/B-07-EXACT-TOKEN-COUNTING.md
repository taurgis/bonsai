# B-07: Add Exact Token Counting

## Goal

Replace rough token estimates when approximate counts are not good enough.

## Scope

- Choose tokenizer based on the model family actually used by agents.
- Keep rough fallback when tokenizer dependency is unavailable.

## Not Before

- The rough `ceil(chars / 4)` estimate causes measured bad decisions.
