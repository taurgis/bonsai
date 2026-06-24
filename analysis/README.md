# Strategic Project Plan and Technical Architecture: Development of the forward-nexus Research Database Plugin

## 0. Pre-Ticket Analysis Pack

Before deriving implementation tickets from this architecture, read the pre-ticket analysis pack:

- [Pre-ticket index](pre-ticket/README.md)
- [Project brief](pre-ticket/PROJECT-BRIEF.md)
- [Target CLI integration](pre-ticket/TARGET-CLI-INTEGRATION.md)
- [Research cache contract](pre-ticket/RESEARCH-CACHE-CONTRACT.md)
- [Decision log and open questions](pre-ticket/DECISIONS-AND-OPEN-QUESTIONS.md)
- [Risks and validation plan](pre-ticket/RISKS-AND-VALIDATION.md)
- [User stories](user-stories/README.md)
- [Implementation tickets](tickets/README.md)

The delivery decision is now fixed: `research` is an optional oclif plugin package developed in this repository, with `/Users/thomastheunen/Documents/Projects/forward-nexus` treated as the host CLI for compatibility, plugin-host enablement, and dogfooding. It must not be implemented as a core command in the main CLI.

## 1. Executive Summary and Architectural Vision

The rapid evolution and proliferation of autonomous artificial intelligence (AI), particularly LLM-driven (Large Language Model) programming and research agents, has fundamentally transformed how software development and information gathering occur. Within this ecosystem, the `forward-nexus` command-line interface (CLI) functions as a central hub for the open-agent ecosystem, distributed as an npm package to manage AI skills and tool access. When these autonomous AI agents consult the internet to gather context—for example, to study API documentation, analyze GitHub issues, or verify error messages—they encounter a significant bottleneck: the raw HTML of modern web pages. This HTML is highly inefficient and contains massive amounts of irrelevant data, such as navigation menus, inline CSS, tracking scripts, footers, and structural boilerplate.

Directly feeding this raw HTML code into an LLM's context window leads to immediate and measurable degradation of system performance. It wastes precious computational tokens, reduces the model's attention span for critical semantic reasoning, and significantly increases the latency of the agent's feedback loop. To address this fundamental inefficiency, there is an architectural imperative for a specialized `oclif` plugin for `forward-nexus` that acts as a local "research result database". This plugin is designed to intercept research requests, perform intelligent web scraping, eliminate markup noise, convert the semantic payload into LLM-optimized Markdown, and cache the results locally. This caching utilizes intelligent, LLM-defined staleness rules to prevent future redundancy.

This exhaustive technical report outlines the detailed project plan, system architecture, data schema, and implementation roadmap required to construct this plugin. The resulting system will enable an AI agent to execute commands such as `forward-nexus research "url" --topic "topic" --tags "tag"` after installing or linking the optional plugin, and immediately receive highly compressed, deterministic, and token-efficient data perfectly tailored to the model's active cognitive capacity.

## 2. Theoretical Framework for Token-Optimized Web Ingestion

Before defining the software architecture, it is necessary to anchor the theoretical mechanisms by which HTML is transformed into token-efficient knowledge. The core problem stems from the fact that LLMs process information via sub-word tokens. A standard modern web page can easily exceed 50,000 tokens of raw HTML, while the actual semantic content representing human-readable text might only span 2,000 tokens. This contrast dictates the necessity for an advanced extraction pipeline.

The pipeline for converting web pages into an LLM-friendly format relies on a structured, multi-stage architecture designed to progressively strip away layers of digital noise. The proposed plugin will implement an extraction architecture consisting of four main stages: Fetch, Clean, Convert, and Structure.

The fetch mechanism must successfully retrieve the Document Object Model (DOM) of the target URL. However, modern web architecture relies heavily on Single Page Applications (SPAs) built with frameworks like React, Vue, or Angular. If the extraction tool solely captures the initial HTTP DOM response, it will likely encounter an empty body tag or a loading skeleton because the actual content requires client-side JavaScript execution to render. Consequently, the plugin must integrate a headless browser implementation, such as Playwright or Puppeteer, to wait for network inactivity and execute JavaScript, thereby capturing the fully hydrated browser render.

Once the DOM is captured, the cleaning phase begins. Heuristic DOM-parsing algorithms, of which Mozilla's `Readability.js` engine (which powers the Firefox Reader View) is the most prominent, analyze the DOM tree using a scoring algorithm. This algorithm assigns positive weights to semantically rich elements like `<article>`, `<p>`, and `<h1>`, while elements associated with `<nav>`, `<footer>`, sidebars, cookie banners, and social media widgets are heavily penalized or completely removed. This methodology isolates the primary semantic payload of the page with a high degree of accuracy, without relying on fragile, site-specific CSS selectors.

Following this extraction, the remaining HTML must be transformed into Markdown. Markdown has become the absolute standard format for LLM ingestion, primarily because it preserves structural hierarchy (headings, lists, code blocks) using a minimal amount of ASCII characters. This aligns seamlessly with the latent space representations upon which modern LLMs are trained. The `Turndown` library is the industry standard for this task within Node.js environments. By configuring `Turndown` to use specific rulesets—such as ATX-style headings (using `#` instead of underlines) and fenced code blocks with backticks—the resulting Markdown becomes highly deterministic and easy to parse for an autonomous agent.

When designing this pipeline for a CLI tool, performance constraints must be carefully monitored. Implementing full headless browser rendering inevitably introduces high latency and significant memory overhead. As an optimization strategy, the plugin's architecture will support a dual-mode retrieval mechanism. This mechanism starts with a fast, HTTP-only fetch using libraries like `axios` or the native `fetch` API for static sites (like Wikipedia or statically generated documentation). If heuristics detect that the page requires client-side rendering, the system automatically switches to the headless browser fallback for complex SPAs.

The transition from raw HTML to cleaned Markdown typically results in a token reduction of 60% to 80%. In highly complex DOM structures, this reduction can be mathematically modeled. This efficiency gain allows the AI agent to maximize its context window for logical reasoning instead of parsing redundant markup code.

## 3. Local Database Architecture and Storage

The plugin is designed to durably store the extracted intelligence in a local "research result database". Since the primary consumer of this database is an AI agent operating in a terminal or shell environment, the storage mechanism must be completely transparent, file-based, and human-readable. The architecture should avoid the opacity of binary database formats like SQLite or proprietary formats, ensuring the agent can directly read and manipulate the files using standard UNIX commands if necessary.

The database will reside in the user's local data directory, utilizing the standardized `oclif` data directory paths. This means data is stored on Unix systems in `~/.local/share/forward-nexus/research/`, on macOS in `~/Library/Caches/forward-nexus/research/`, and on Windows in `%LOCALAPPDATA%\forward-nexus\research\`. To ensure rapid retrieval and prevent directory bloat, the files are organized hierarchically based on a cryptographic hash (SHA-256) of the normalized URL, combined with agent-readable slugs for the filename.

To meet the explicit requirement of offering the LLM a choice between different data densities, each successful research task will generate a single, unified Markdown document. This document is conceptually divided into two primary structural blocks, with metadata strictly managed by a YAML frontmatter block at the absolute top of the file.

### 3.1 Data Model and YAML Frontmatter Specification

At the top of each saved research file, a YAML block will store critical metadata. This structured data allows the `forward-nexus` CLI to quickly index, filter, and validate the cache without having to parse the full text content (body) of all files. This is a fundamental design principle for performance optimization.

| Field Name | Data Type | Description and System Function |
| --- | --- | --- |
| `id` | String (UUIDv4) | A unique identifier for the research artifact, used for internal associations and reference by the agent. |
| `source_url` | String | The original, normalized URL of the extracted web content. Essential for cache validation. |
| `topic` | String | A broad, semantic categorization provided by the agent during the initial CLI invocation. |
| `tags` | Array of Strings | Specific taxonomic markers (e.g., `["react", "performance", "hooks"]`) provided by the agent. |
| `extracted_at` | ISO 8601 Date | The exact, universal timestamp when the web page was last successfully scraped. |
| `stale_after` | ISO 8601 Date | The dynamic expiration timestamp, determined by the predictive intelligence of the LLM based on estimated content volatility. |
| `volatility_score` | Float (0.0 - 1.0) | A score assigned by the LLM indicating how quickly the source data is expected to mutate. |
| `token_estimate` | Integer | An approximation of the token count of the stored Markdown, crucial to assist the LLM in context budgeting before loading the payload. |
| `hash` | String (SHA-256) | A checksum of the content, used to detect if the upstream content has changed during a subsequent cache re-evaluation. |

### 3.2 Dual-Layer Content Representation (Compression vs. Detail)

A critical architectural requirement of the system is the provision of both a "compressed" and a "detailed" data representation. This concept of variable information density allows the LLM to select the most appropriate version based on its immediate cognitive constraints and the remaining capacity of the context window.

The detailed representation preserves the highest degree of semantic precision from the source page. This variant includes the full structural hierarchy as translated by the `Turndown` engine, retaining all internal and external hyperlinks, nested tables, blockquotes, and inline formatting like bold and italic text. This version is optimal when the agent is engaged in in-depth, investigative work and requires exact technical nuances, code examples, or reference links to solve a complex problem.

In contrast, the compressed representation is an aggressively pruned version of the text. This variant operates purely on the principle of a maximized signal-to-noise ratio. In this mode, the conversion pipeline performs active text manipulations: excessive whitespace is collapsed, all hyperlink URLs are removed leaving only the anchor text, complex tables are flattened into simple key-value lists, and less important subheadings are completely ignored or merged. Furthermore, the plugin can be locally configured to pass the detailed Markdown through a local, lightweight summarization model or a rule-based extraction method to retain only the core claims and factual assertions. This creates an ultra-dense intelligence briefing for the LLM.

When the LLM invokes the plugin-provided `forward-nexus research` command, it appends a flag to the syntax, such as `--format=compressed` or `--format=detailed`. Based on this flag, the CLI will dynamically retrieve and return the representation that best serves the active process at that specific moment. This mechanism drastically improves the performance of multi-agent systems, where a planning agent might request the compressed version for a quick overview, while a programming agent later requests the detailed version for specific syntax examples.

## 4. Advanced Caching and LLM-Driven 'Staleness' Management

A robust and advanced caching layer is vital to prevent redundant network requests, IP bans, and API throttling. Traditional web caching and CLI caching mechanisms predominantly rely on static Time-To-Live (TTL) values hardcoded by the developer. However, the `forward-nexus` plugin introduces an innovative paradigm: LLM-driven determination of data staleness.

### 4.1 Implementation of the Predictive Freshness Algorithm

Not all web data expires or ages at the same rate. A live news article or a web page with financial stock quotes is highly volatile and could be outdated within minutes or hours. Conversely, API documentation for an older software library, or a Wikipedia article on a mathematical concept, has extreme longevity and can remain accurate for months without needing re-extraction.

When the AI agent requests new research, it analyzes the context of the URL and passes a predictive volatility assessment to the CLI. For example, if the agent evaluates the URL `[https://react.dev/reference/react/useState](https://react.dev/reference/react/useState)`, it concludes that this is technical documentation with a medium update frequency. The agent then invokes the command with an explicit flag, such as `--ttl=30d`. The CLI immediately calculates the `stale_after` timestamp by adding exactly 30 days to the current system execution time and writes this to the YAML frontmatter.

When future queries are made for the same URL, either by the same agent or a parallel instance, the CLI instantly performs a freshness calculation:

1. The CLI locates the file in the `~/.local/share/forward-nexus/research/` data directory.
2. The YAML frontmatter is parsed to load the metadata into memory.
3. The current system time is compared to the stored `stale_after` timestamp.
4. If the current time falls before the `stale_after` boundary, the cache qualifies as a "Hit", and the local Markdown file is immediately presented to the LLM, resulting in a response time of a few milliseconds.
5. If the current time exceeds the `stale_after` boundary, the cache is marked as "Stale".

### 4.2 Integration with the Model Context Protocol (MCP)

The Model Context Protocol (MCP) is an emerging industry standard that regulates how AI applications and agents interact with external data sources and establishes strict paradigms for caching. The `forward-nexus` research database essentially functions as a specialized local MCP cache server, designed to reduce token consumption by efficiently storing what would otherwise need to be constantly re-parsed.

According to MCP guidelines, cached responses are identified by a combined cache key. Within this plugin, the cache key is defined by the invocation command (`research`) combined with specific parameters that influence the outcome (the normalized URL and the requested `--format`). This ensures that a request for the "compressed" version does not accidentally serve the "detailed" version from the cache, unless the architecture is locally capable of compressing the detailed version on-the-fly.

To comply with enterprise-grade caching patterns, the plugin also implements a tiered validation approach. Even when a document is classified as "Stale" based on the LLM-driven timeline, the CLI will not immediately delete or overwrite the document. Instead, the CLI initiates a conditional HTTP `GET` request, utilizing protocols like the `If-Modified-Since` or `ETag` headers if available on the target server. If the source server responds with a `304 Not Modified` status, the content has not changed despite the expired TTL. In that scenario, the CLI simply updates the `extracted_at` and `stale_after` timestamps in the frontmatter with a new, extended value. This preserves the existing local Markdown and completely bypasses the computationally expensive DOM-parsing and Markdown-conversion pipeline, significantly minimizing operational latency for the agent.

Another essential concept from the MCP architecture incorporated here concerns the traceability and idempotency of requests. Because the agent might generate identical research requests while iteratively building context, this robust local storage layer prevents redundant side-effects on the web, preventing network blocks due to excessive scraping.

## 5. Oclif Plugin Implementation and System Integration

The `forward-nexus` ecosystem uses the Open CLI Framework (`oclif`) as its foundation. This framework, originally developed by engineers at Heroku and now maintained by Salesforce, offers a highly structured, TypeScript-based architecture for building modular, extensible command-line interfaces and plugins. Oclif stands out from simpler argument parsers like Commander or Yargs by providing a complete ecosystem including automatic documentation generation, a plug-in architecture, and robust performance with large numbers of commands.

Constructing this research database plugin requires rigorous adherence to the architectural conventions of `oclif`. This guarantees compatibility, predictability, and low plugin load overhead, which is a critical requirement for CLI tools driven autonomously by AIs.

### 5.1 Plugin Scaffolding and Performance Optimization via Manifests

The project is initiated in this repository via the standard `oclif` plugin generation flow. By running `npx oclif generate` for a plugin package, or manually creating the same structure, a complete TypeScript package is generated here. This package includes the necessary configuration files, test environment, and integrated build pipeline.

The heartbeat of the plugin configuration resides in this repository's `package.json` file. It is mandatory to declare the command discovery target, aliases if any, and potential hooks within the special `oclif` namespace in this JSON file. Official oclif documentation states that plugins can provide commands and hooks, and that `oclif.manifest.json` is used instead of normal command discovery when present. The plugin package must therefore generate and ship `oclif.manifest.json` so the host CLI can load the optional research plugin without scanning command files on every invocation.

### 5.2 Command Structure and Argument Parsing

The core functionality of the plugin will manifest in a newly defined `oclif` Command class in this repository, exposed through the host as `forward-nexus research` once the plugin is installed or linked. The implementation rests on the powerful parsing engine of `@oclif/core` to ensure that interactions with the LLM are strictly validated and that errors or hallucinations by the LLM immediately lead to clear, parsable error messages.

Within CLI design principles, there is a clear distinction between arguments (positional input) and flags (optional or named input). Arguments are rigid and order-dependent, while flags allow for a much more flexible input structure. Because LLMs sometimes vary the syntactic order with which they invoke tools, the architecture will treat the URL as the only required, strict argument, while defining all other parameters (such as topic, tags, and format) as flexible flags.

The class definition for the command will be constructed as follows using `@oclif/core` data structures:

| Input Type | Name | Data Type & Configuration | Functionality |
| --- | --- | --- | --- |
| **Argument** | `url` | `Args.string({required: true})` | The target web page to be researched by the LLM. This is the primary identifier for scraping and cache lookup. |
| **Flag** | `--topic` | `Flags.string()` | A broad semantic category (e.g., "React Performance") used for organization in the frontmatter. |
| **Flag** | `--tags` | `Flags.string({multiple: true})` | Granular taxonomic markers. The `multiple: true` setting allows the agent to use syntax like `--tags=AI --tags=Scraping`, parsed as a string array. |
| **Flag** | `--format` | `Flags.option({options: ['compressed', 'detailed']})` | Instructs the CLI on the required data density. Built-in type checking throws an error if the LLM invents a different format. |
| **Flag** | `--ttl` | `Flags.string()` | A duration indicator (e.g., `24h`, `7d`, `3m`) produced by the LLM based on internal assessment to set the `stale_after` value. |
| **Flag** | `--json` | Host-compatible JSON envelope | A machine-readable mode that emits the `forward-nexus` JSON envelope and keeps logs, warnings, and progress out of stdout. Crucial for safe AI parsing. |

By using the asynchronous `this.parse()` method within the command's `run()` function, the plugin enforces input validation. Missing required fields or incorrect formats result in a standardized error message, allowing the LLM to automatically correct and resubmit its request.

## 6. Usage Instructions, Formatting, and CLI Interaction

An explicit requirement for the plugin is providing crystal-clear instructions regarding formatting and usage for the consuming entity—in this case, the autonomous AI agent. The interface the agent consults to understand the tool's capabilities is the built-in `--help` output of `oclif`. To ensure the LLM instantly grasps how to deploy the tool and what the return value will be, the command class will be equipped with comprehensive static documentation properties.

When the agent executes `forward-nexus research --help` with the plugin installed or linked into the host CLI, the framework will dynamically generate an exhaustive, structured manual based on the `description`, `summary`, and `examples` properties of the class. This documentation explicitly highlights the dual data layer and the TTL mechanism.

### Representation of CLI Help and Instructions for the LLM

The generated help text that the agent will consume will be presented as follows:text
USAGE
$ forward-nexus research [URL] [FLAGS]

DESCRIPTION
An advanced, locally cached web research tool optimized for LLM ingestion.
This tool scrapes the specified URL, strips all HTML boilerplates, and converts
the semantic payload into clean Markdown format.

The tool supports two data densities via the --format flag:

1. 'compressed': Removes all links, images, and flattens tables. Optimal for context budgeting.
2. 'detailed': Retains full Markdown hierarchy and links. Optimal for in-depth analysis.

The AI agent MUST determine an expected Time-To-Live (TTL) based on the volatility
of the target URL to enable efficient caching.

ARGUMENTS
URL  The full HTTP/HTTPS link to the web page to be researched.

FLAGS
-t, --topic=       The main category of the research for metadata tagging.
-g, --tags=        Comma-separated tags or multiple flag usages for taxonomy.
-f, --format=     [default: compressed] Desired data density. <options: compressed|detailed>
-l, --ttl=         Predicted lifespan of the data (e.g., '24h', '7d', '1m').
--json                    Return the output as a machine-readable JSON object.

EXAMPLES
$ forward-nexus research [https://docs.nestjs.com/](https://docs.nestjs.com/) --topic "Backend Frameworks" --tags "Node, NestJS" --format detailed --ttl 30d

$ forward-nexus research [https://news.ycombinator.com/](https://news.ycombinator.com/) --format compressed --ttl 2h --json

```

The addition of the `--json` flag here is one of the most critical interaction elements. To prevent text output from terminal loaders or console warnings from breaking the agent's JSON parser, `oclif` ensures that when the agent uses `--json`, it strictly formats the output. The returned JSON object will perfectly match the schema of the YAML frontmatter plus a `content` field containing the actual Markdown, allowing the agent to programmatically process it flawlessly.

## 7. Development Phases and Roadmap

The systematic construction and implementation of the `forward-nexus` research database plugin requires a highly phased, modular development approach. The following roadmap guarantees isolated testing of subsystems before they are fully integrated into the active agent ecosystem.

### 7.1 Phase 1: Foundation and Scaffolding
The initial phase centers around setting up robust project infrastructure in this repository. The engineer will scaffold a TypeScript oclif plugin package, configure `package.json` and `tsconfig.json` to follow ECMAScript Modules (ESM), and ensure the package can be linked into the `forward-nexus` host for dogfooding. In this phase, the essential dependencies are evaluated and installed only after the dependency spike: `@oclif/core` for CLI logic, `@mozilla/readability` for semantic DOM extraction, `turndown` for Markdown conversion when detailed Markdown is in scope, and a DOM implementation such as `linkedom` or `jsdom`.

### 7.2 Phase 2: Extraction and Conversion Engine
Phase 2 covers the core logic for data transformation. A specialized service is built to handle HTTP requests. In the first iteration, an HTTP client (like `axios` or native Node.js `fetch`) will fetch the raw HTML of static pages. This raw HTML string is loaded into an instantiated `JSDOM` environment to mimic a web browser's structure.

This simulated `window.document` object is passed to the `Readability` constructor, which performs its heuristic pruning and returns a cleaned `article` object. This fragment is then handed to a carefully calibrated `TurndownService` instance. The rules of the Turndown engine must be configured to ensure that stray `<style>` and `<script>` tags that may have bypassed the Readability filter are absolutely stripped. The result of this phase is a perfectly clean, raw Markdown string that forms the foundation for further processing.

### 7.3 Phase 3: Implementation of the Dual-Layer Architecture
Once the basic Markdown is reliably generated, the system must process it to meet the dual-layer requirement. The `detailed` version is essentially the direct output of the Turndown engine, retaining all anchors and links. The `compressed` version, however, requires a secondary pipeline using iterative RegEx manipulations: extracting only text from links (reducing `[documentation](https://example.com/docs)` to `[documentation]`), bulk-removing all Markdown image tags, flattening complex tables, and normalizing sequential blank lines to drastically limit vertical length and token count. Both variants are then typed and stored in memory as part of the data object awaiting persistence.

### 7.4 Phase 4: Local Database Management and Frontmatter Injection
This phase introduces the storage and state management system. The plugin calls `this.config.dataDir` via the oclif configuration instance to dynamically determine the correct OS-specific path for the database on the host machine. After the research (extraction and compression) is completed in memory, the system constructs the YAML frontmatter block. Here, the logic implements the `stale_after` mechanism: the script parses the `--ttl` string, converts it to a temporal offset, and calculates the exact expiration date. If the agent omits the TTL flag, the system falls back on a conservative, hardcoded default value.

Finally, the assembled file is safely written to disk. In parallel, a lightweight index file (like a JSON map) is updated, linking hashed URLs directly to their respective system paths. This guarantees that future cache validations occur in $O(1)$ lookup time, without requiring heavy read operations on the file structure.

### 7.5 Phase 5: AI Agent Integration and Output Formatting
The final implementation phase polishes the interface between the terminal application and the LLM. When the agent fires a command at a URL, the CLI seamlessly orchestrates cache behavior: for a valid cache hit, it bypasses the network completely, rapidly reads the local file, extracts the requested variant based on the `--format` flag, and sends it to standard output. Enabling the `--json` flag hardens the output to ensure no human-readable messages leak, making the output 100% predictable for the AI agent's abstraction layers. Robust Unit Tests via Mocha are also developed to ensure edge cases and timeouts are caught gracefully and returned as actionable warnings to the agent.

## 8. Security, Compliance, and Ethical Considerations

Developing a tool that autonomously performs high-frequency network requests and stores data locally brings significant technical and ethical responsibilities that must be deeply anchored in the architecture.

From a strict security perspective, the local storage database and cache lookup system must be watertight against directory traversal or path traversal attacks. Since a "hallucinating" or manipulated LLM might intentionally pass malicious strings in the URL or Tag parameters, the argument-parsing layer must rigorously sanitize and reject invalid file paths before any filesystem action occurs. Additionally, it is crucial to build protections against infinite scroll DOM structures, enforcing hard timeouts and strict limits on the maximum memory footprint of the downloaded string to prevent Out-Of-Memory (OOM) crashes.

Ethically, the scraping module must absolutely respect web standards. It should operate transparently by identifying itself with a custom User-Agent string, submit to automated rate-limiting with polite delays between requests, and adhere to `robots.txt` restrictions wherever possible.

Finally, regarding long-term data persistence, the tool must explicitly ensure that sensitive credentials, API keys, or session tokens—which might inadvertently hitchhike in URLs or be hardcoded in a leaked DOM—are not permanently archived unencrypted in this local vault.

## 9. Conclusion

The seamless integration of a highly optimized, local research database into the `forward-nexus` CLI represents a critical, quantifiable advancement in the operational autonomy and efficiency of modern AI agents. By designing a system that prevents the LLM from wasting costly energy and context window space processing raw, boilerplate-saturated HTML code, this `oclif` plugin addresses the most stubborn bottleneck in agentic, open-ended web research: the exhaustion of the available cognitive context budget.

The proposed architecture delivers an extremely resilient and modularly built multi-stage pipeline. It cleverly leverages `oclif`'s powerful command structure, parsing validation, and blazing-fast manifest-based plugin ecosystem to guarantee a frictionless interface for the AI. It relies on academically validated and industry-proven DOM heuristics via Mozilla Readability and Turndown to uncompromisingly compress digital redundancy into pure semantic Markdown. By structuring the resulting information strictly with comprehensive YAML frontmatter headers and simultaneously offering representations in different data densities, the system grants the LLM agent unprecedented, modular control over its own information load and processing capacity.

The most fundamental innovation of the plan lies in the introduction of the AI-determined staleness algorithm. This paradigm shifts the static TTL caching approach to a dynamic, predictive mechanism where the language model itself, based on semantic assessment and volatility estimates, dictates the temporal relevance and shelf-life of its gathered intelligence. This synergy ensures that the `forward-nexus` infrastructure grows into an unparalleled and robust ecosystem, ready for the era of exponentially fast, autonomous knowledge acquisition by machines.

## 10. Implementation Plan: Tickets and User Stories

To seamlessly execute the roadmap outlined in Section 7, the project is broken down into structured, actionable Agile tickets. These tickets contain precise User Stories and Acceptance Criteria geared toward the development team building the `oclif` plugin.

### Epic 1: Plugin Scaffolding and Core Framework

**Ticket 1.1: Initialize `oclif` Plugin Infrastructure**
*   **User Story:** As a developer, I want to initialize the plugin package in this repository using `@oclif/core` and ECMAScript Modules (ESM) so that the tool is compatible with modern Node.js standards and the `forward-nexus` host CLI.
*   **Acceptance Criteria:**
    *   The plugin project structure is scaffolded in this repository.
    *   `package.json` and `tsconfig.json` are explicitly configured to support ESM.
    *   The plugin manifest (`oclif.manifest.json`) generation script is integrated into the build pipeline.
    *   Basic test suites (Mocha/Chai) are wired and passing.

**Ticket 1.2: Construct the `research` Command Class and Argument Parser**
*   **User Story:** As an AI agent, I want to execute the CLI with specific arguments and flags (`url`, `--topic`, `--tags`, `--format`, `--ttl`, `--json`) so that I can provide precise directives for my research task.
*   **Acceptance Criteria:**
    *   A new plugin command file under this repository's `src/commands/` tree extends the `@oclif/core` `Command` class.
    *   The `url` is configured as a required positional `Arg`.
    *   Flags for `--topic`, `--tags` (multiple), `--format` (options: `compressed` | `detailed`), and `--ttl` are mapped out using `Flags.string` and `Flags.option`.
    *   JSON output follows the `forward-nexus` envelope expected by host integrations.

### Epic 2: Web Extraction and Markdown Pipeline

**Ticket 2.1: Develop the Dual-Mode Fetch Service**
*   **User Story:** As the extraction engine, I want to execute a standard HTTP GET request first, and fallback to a headless browser if needed, so that I can capture the full DOM of both static sites and SPAs.
*   **Acceptance Criteria:**
    *   `axios` or native `fetch` captures the initial HTTP response.
    *   A timeout/size limit prevents OOM errors.
    *   *Stretch:* Basic SPA detection heuristics trigger a Playwright/Puppeteer fallback if the HTML body is mostly empty.

**Ticket 2.2: Implement HTML Cleaning and Semantic Extraction**
*   **User Story:** As the processing pipeline, I want to filter the raw DOM using Mozilla's Readability engine so that boilerplate, navigation, and ads are removed before conversion.
*   **Acceptance Criteria:**
    *   The raw HTML is loaded into `jsdom` to create a virtual DOM environment.
    *   `@mozilla/readability` parses the document and extracts the main article content.

**Ticket 2.3: Convert and Structure Markdown Versions**
*   **User Story:** As an AI agent, I want the cleaned HTML transformed into two Markdown densities (compressed and detailed) so that I can optimize token consumption based on my immediate needs.
*   **Acceptance Criteria:**
    *   The `turndown` library is configured to use ATX-style headings and fenced code blocks.
    *   **Detailed Version:** Standard Turndown output is saved.
    *   **Compressed Version:** Regex pipelines strip image tags, flatten markdown tables, and extract raw text from hyperlink tags.

### Epic 3: Local Caching and Data Management

**Ticket 3.1: Develop the File System Database and YAML Generator**
*   **User Story:** As the storage layer, I want to save the processed Markdown files with YAML frontmatter to the local machine so that the AI agent can query them directly.
*   **Acceptance Criteria:**
    *   `this.config.dataDir` is used to resolve the correct OS-specific storage path.
    *   The URL is hashed (SHA-256) to generate deterministic, collision-free filenames.
    *   A YAML frontmatter block is constructed at the top of the file containing `id`, `source_url`, `topic`, `tags`, and `token_estimate`.

**Ticket 3.2: Implement the AI-Driven Staleness Algorithm**
*   **User Story:** As the cache validator, I want to calculate and verify dynamic expiration dates based on the agent's TTL prediction so that I don't serve outdated information.
*   **Acceptance Criteria:**
    *   The `--ttl` flag string (e.g., "7d") is parsed into a real timestamp (`stale_after`).
    *   Prior to initiating a fetch, the CLI checks the local cache directory.
    *   If a file exists and `Date.now()` is less than `stale_after`, the system triggers a Cache Hit and bypasses the network layer entirely.

### Epic 4: Integration and Output Formatting

**Ticket 4.1: Finalize AI-Readable Outputs and Error Handling**
*   **User Story:** As an AI agent, I want to receive deterministic JSON outputs and clear error messages so that my internal JSON parser doesn't break during workflow execution.
*   **Acceptance Criteria:**
    *   When the `--json` flag is present, standard `oclif` stdout logging is suppressed.
    *   The final response object perfectly mirrors the YAML frontmatter schema and includes a `content` string with the requested Markdown.
    *   All validation errors (e.g., invalid URL, missing arguments) throw structured JSON errors with actionable suggestions for the LLM.

```
