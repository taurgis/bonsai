# Beginner Technical Writing Examples

## Example 1: Define term before usage

### Before

Use `BasketMgr` to handle these flows and make sure your hooks are aligned.

### After

`BasketMgr` is the SFCC server-side API for reading and updating the current shopper basket. In this flow, we use it to confirm the basket state before checkout continues.

## Example 2: Explain cause and effect

### Before

This hook is useful for checkout behavior.

### After

This hook runs before checkout advances. If validation fails, it returns an error and checkout stays on the current step.

## Example 3: Add concise architect implication

### Implementation explanation

This controller collects basket totals and renders the checkout summary.

### Architecture note

If multiple controllers need the same totals logic, move it into a shared service so totals stay consistent across entry points.