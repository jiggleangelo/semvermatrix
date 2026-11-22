# SemVerMatrix

Original, original MIT browser tool by Manykiln. Open index.html directly in a modern browser. No server, install, dependencies, CDN, account, registry lookup, browser storage, telemetry or network access is used by the application. Examples are fictional.

Inspect constraints from several consumers of **one shared package**. Each dependency name identifies a consumer; it does not name a separate package with an independent version. The tool computes exact range intersections, a minimum possible witness, a sorted matrix over your available version set, and exact incompatible pairs. A missing available version is reported separately as a coverage gap. This is not npm, a dependency solver, registry data, lockfile analysis, or a input handling/advisory scanner.

```json
{"dependencies":[{"name":"web-client","range":"^1.2.0"},{"name":"build-plugin","range":"~1.4.2"}],"versions":["1.4.1","1.4.2","1.4.9","2.0.0"]}
```

Supported range terms: exact full versions (optional =), caret ^, tilde ~, comparators > >= < <=, partial versions (1, 1.2), x/X/* wildcards, whitespace AND, and || OR. Operators can have whitespace before their version. Examples:

| Range | Stable interpretation |
|---|---|
| ^1.2.3 | >=1.2.3 and <2.0.0 |
| ^0.2.3 | >=0.2.3 and <0.3.0 |
| ^0.0.3 | >=0.0.3 and <0.0.4 |
| ^0.0 | >=0.0.0 and <0.1.0 |
| ~1.2.3 or 1.2.x | >=1.2.3 (or 1.2.0) and <1.3.0 |
| >1.2 | >=1.3.0 |
| <=1.2 | <1.3.0 |
| <1.2 | <1.2.0 |
| * | Any stable version, starting 0.0.0 |

Full versions must have major.minor.patch, optional prerelease and optional build metadata. Leading zeroes are rejected in numeric core/prerelease identifiers. Build metadata does not affect precedence. Numeric identifiers compare exactly using BigInt / digit ordering, reducing floating-point rounding. Available versions are deduplicated by exact string and sorted by SemVer precedence, then raw-string lexical order for metadata ties.

Prerelease gating: each selected OR clause must explicitly mention a prerelease comparator with the same major.minor.patch tuple. Generated exclusive upper bounds use -0 and do not open this gate. Thus ^1.2.3 excludes 2.0.0-alpha, and >=1.2.3-alpha <2.0.0 admits 1.2.3-beta but excludes 1.3.0-beta. Combining constraints intersects these admission tuples. Stable releases do not need the prerelease gate. An exact 1.2.3+build matches all builds at that precedence.

Minimum possible is computed over the mathematical supported SemVer domain. Each conjunction produces its least stable or admitted prerelease witness; a strict prerelease lower bound advances by appending .0. OR intersections are searched deterministically and empty branches pruned. Minimum available is independently selected from supplied versions. A conflict pair has an actually empty pair intersection and includes both names and ranges; a coverage gap includes a nonempty witness. With OR ranges, every pair may overlap even when the full intersection is empty: higherOrderConflict identifies this explicitly. Internally contradictory single ranges get minimumPossible:null and a one-dependency report is incompatible even though there is no pair.

Unsupported syntax fails loudly: empty ranges (use *), hyphen ranges, commas, tags/latest, aliases, URLs, v prefixes, parentheses, exclusions (!=), malformed wildcards and strict comparators against total wildcards (>*, <*). There is no prerelease opt-in override. This documented grammar is not a claim of full npm/node-semver compatibility.

Limits: 1..16 unique named dependency constraints; names at most 100 characters; 1..300 full available version strings; each version at most 256 characters; each range 1..1000 characters, 1..8 OR clauses, at most 16 terms per clause. A deterministic intersection search halts after 20000 visited branches and reports an error, never an approximate answer. The UI caps raw JSON at 100000 characters. Input edits/clear invalidate old reports and disable export. All names, versions, ranges and errors render as text; input is never executed.

## Run, test and fork

Open `index.html` beside the supplied JavaScript and CSS files, or use any static server. The delivery includes paired suites and their shared test support. Use the delivery's `verify.sh` to run the complete suites in a disposable workspace with WebCrypto enabled; some retained suites require that workspace. The tool entrypoint is `tests/core.test.mjs` (`node:test`). Fork the MIT source and retain its license.

[Tool page](https://manykiln.com/tools/semvermatrix/) · [Source code](https://github.com/jiggleangelo/semvermatrix) · [Join the list](https://join.manykiln.com/?from=semvermatrix) · [Privacy](https://manykiln.com/privacy)
