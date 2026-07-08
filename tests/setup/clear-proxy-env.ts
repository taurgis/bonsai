// Running inside a sandboxed dev environment (e.g. Claude Code's remote sandbox) sets these to
// route egress through a proxy. Left as-is, they'd silently flip every test onto the proxy
// codepath in fetcher.ts/browser.ts regardless of what the test intends to exercise.
delete process.env.HTTPS_PROXY;
delete process.env.https_proxy;
delete process.env.HTTP_PROXY;
delete process.env.http_proxy;
delete process.env.NO_PROXY;
delete process.env.no_proxy;
