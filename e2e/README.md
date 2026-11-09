# Browser checks

`control-sandbox.cjs` drives the running dev server in a real Chromium with a
phone viewport and touch enabled, and asserts the things unit tests cannot
reach: pointer capture, multi-touch, rotation, DPR sizing, persistence.

It is deliberately not wired into `npm test`, because it needs a browser
binary that CI may not have.

```bash
npm run dev            # in one shell
npm i -D playwright && npx playwright install chromium   # once
node e2e/control-sandbox.cjs
```

Screenshots are written next to the script's `SHOT` path; adjust it before
running elsewhere.
