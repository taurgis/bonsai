# Isn't this just like memory?

No. Memory and Bonsai solve different problems, and it is worth being clear about
which one this tool is for.

## Memory remembers; Bonsai reads

An agent memory stores what the agent has been through: your preferences, a
decision it made last week, a fact it was told, an error it already fixed. That
is recall of the agent's own experience, and it is subjective by design. Two
agents that did different work remember different things.

Bonsai stores none of that. It fetches a real web page, prunes it to fit a
context window, keeps the headings, code, tables, and lists, and hands back the
documentation with its source attached (see
[Compression & Token Budgeting](/concepts/compression)). The result is the page,
not the agent's memory of the page. Point ten agents at the same URL and they
all get the same bytes.

The honest one-line answer: memory is about what an agent knows. Bonsai is about
making the web cheap to read.

## The cache is a speed benefit, not the mission

This is the part that invites the comparison, so it is worth separating out.
Bonsai keeps what it fetched in a local cache. That looks like storage, and
storage looks like memory. But the cache sits on top of the real work. It is not
the work itself.

The real work is the transform: take a raw page worth tens or hundreds of
thousands of tokens and return a few thousand tokens of complete, structured
documentation. That happens on the very first fetch, against an empty cache. The
`--dry-run` flag makes the point directly. It crawls, extracts, and compresses
without writing anything to disk. Nothing is stored, and you still get the
pruned page back.

Take the cache away entirely and Bonsai still does its job. It just does it every
time instead of once. The [research benchmark](/examples/agent-research-comparison)
holds whether the result is cached or thrown away after a single read.

## But speed matters too

Here is the other side, because waving the cache off as incidental would be
dishonest. Re-fetching the same page on every call is slow, spends tokens you
did not need to spend, and returns a slightly different answer each time a model
sits in the loop. None of that is acceptable for an agent doing real work.

So the cache earns its place. It turns the second, tenth, and hundredth read of
a page into an instant, deterministic lookup, and that speed is a benefit we care
about. What matters is the ordering. Cheap, faithful access to the web is the
goal; caching is how we keep it cheap once the same page comes up again.

Both things are true at once. Bonsai is not a memory of the web. It is a cheaper
way to read it, and the cache is what stops that cheapness from eroding on the
next request.
