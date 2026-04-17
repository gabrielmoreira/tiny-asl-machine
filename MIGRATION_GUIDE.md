# Migration guide: 0.0.10 -> 1.0.0

## Short summary

If you are upgrading from the last npm-published release (`0.0.10`), the main story is:

- `1.0.0` is a much more AWS-aligned release
- many features are simply **new** compared with `0.0.10`
- some older permissive local behaviors are now stricter
- tests that assert exact full error/cause strings may need to loosen to substring or structural assertions

If you only do one thing after upgrading:

## rerun your local workflow tests, and rerun AWS-backed checks for parity-sensitive workflows

---

## What is new in 1.0

These should mostly be read as **new capability**, not breakage from the published `0.0.10` baseline.

### JSONata is now a serious supported surface

`0.0.10` did not provide the current JSONata story.

`1.0.0` adds or greatly expands:

- JSONata-focused conformance coverage
- JSONata Assign / Output / composition coverage
- stronger parity work around JSONata evaluation order, scope, and result handling
- clearer boundaries for JSONata cases that are still intentionally local-only

### Much broader conformance coverage

The project now carries substantially more behavior coverage across:

- `Task`
- `Catch`
- `InputPath`
- `Map`
- `Parallel`
- `TaskShapes`
- JSONata composition
- many intrinsic-function groups

### More pure-ASL dual-environment cases

Several suites that previously depended on local mocks were rewritten onto pure ASL constructs and now run naturally in both local and AWS-backed modes.

---

## Improvements in 1.0

These are places where existing behavior became stronger, clearer, or more AWS-aligned.

### Stronger intrinsic-function support

`1.0.0` brings broader and stricter intrinsic support, especially in areas such as:

- `States.Format`
- `States.MathAdd`
- `States.MathRandom`
- `States.Hash`
- `States.Base64Encode` / `States.Base64Decode`
- literal numeric / boolean / null argument handling
- object/array equality-sensitive intrinsic cases

### Better Task / Catch / dataflow parity

Behavior is now much more strongly pinned with AWS-backed evidence around:

- `InputPath`
- `ResultPath: null`
- `OutputPath`
- `ResultSelector` + `ResultPath` + `OutputPath` composition
- Catch routing and Catch ordering
- Task scalar / array / object result shapes
- plain vs custom error shapes

### Better Map / Parallel structure coverage

Behavior around:

- raw iterator input
- `Map.Parameters` / `ItemSelector`
- aggregate output shaping
- branch/container failure behavior
- pure-ASL structural semantics

is much more explicitly covered than it was in the old published line.

---

## Migration-sensitive changes

These are the areas most likely to surprise someone upgrading.

### 1. Intrinsics are less permissive

Some invalid or loosely handled intrinsic invocations that may have slipped through before now fail more clearly.

Possible symptoms:

- an expression that used to run locally now throws
- error type becomes `States.Runtime` or `States.IntrinsicFailure`
- error wording changes because behavior is now closer to AWS

Recommended action:

- review workflows that depend heavily on intrinsics
- pay special attention to argument count, argument type, and literal parsing

### 2. JSONPath-style dataflow is stricter in some places

One concrete example:

- `{% ... %}` wrapper strings are no longer evaluated in JSONPath mode; they remain literal strings

If you relied on JSONata-looking strings being interpreted inside JSONPath-mode dataflow, treat that as a breaking assumption.

### 3. Error / cause assertions may need to change

As more behavior became dual-environment and AWS-backed, some `Cause` payloads are now better treated as structured or partially stable rather than fully exact text.

Recommended test style in `1.0.0`:

- assert exact `Error` names when stable
- assert `Cause` via substring or structural facts when AWS wraps message payloads

### 4. Public runtime expectations may be broader than before

Even if this is not a common npm-user concern, contributor / extender code should verify custom runtime wiring against the current runtime surface.

If you provide a custom runtime adapter, verify support for functions such as:

- `now`
- `sleep`
- `randomUUID`
- `random`
- `hash`
- `base64Encode`
- `base64Decode`

Treat this more as a **surface expansion** than a pure break from a widely used public API, but it is still worth checking if you extend the runtime directly.

---

## Known intentional divergences that still matter

`1.0.0` is much stronger than `0.0.10`, but it is still not a full AWS clone.

Areas that still deserve caution:

- advanced distributed `Map` / `ItemReader`
- full callback / task-token fidelity
- local Parquet decoding
- exact AWS validation wording in every edge case
- deterministic timing / concurrency observations
- some null-path or out-of-spec path shapes intentionally retained as local characterizations

Rule of thumb:

- if a case is marked local-only, the reason should be explicit
- if parity matters for your workflow, use the AWS-backed conformance path

---

## Upgrade checklist

### For package users

- rerun your local workflow tests against `1.0.0`
- rerun AWS-backed checks for parity-sensitive workflows
- review workflows that rely heavily on intrinsic functions
- review workflows that rely on unusual `InputPath` / `OutputPath` / `ResultPath` shapes
- relax tests that assert exact full `Cause` strings when a stable substring or structural assertion is more appropriate

### For contributors / power users

- verify any custom runtime usage
- review tests that depended on older local-only quirks
- prefer conformance-first changes
- prefer AWS proof before parity-sensitive runtime changes

---

## What to test first after upgrading

If you only have time for a small regression pass, prioritize:

- intrinsic-heavy workflows
- JSONPath / JSONata dataflow shaping
- Task + Catch + ResultPath / OutputPath behavior
- `Map` / `Parallel` workflows
- any custom runtime integration points

---

## Operational note: loops, waits, retries

Do not treat either Tiny ASL Machine or AWS Step Functions as a safety mechanism against poor workflow modeling.

On AWS:

- there is no single magical anti-infinite-loop semantic guard
- long or repeating workflows are constrained in practice by execution duration, timeouts, wait limits, retry policy, quotas, and cost
- `Wait` itself has documented maximum durations depending on workflow type

Practical recommendation:

- use explicit timeouts
- use explicit retry limits
- do not assume either local or AWS execution will save you from an accidentally self-looping design

---

## Bottom line

Treat `1.0.0` as:

- significantly more AWS-aligned than `0.0.10`
- stricter in important areas
- much better covered by conformance
- safer for serious workflow testing

Also assume:

- some permissive `0.0.10` behavior may stop working
- some error names / causes / validation outcomes may differ
- parity-sensitive workflows should get one real AWS-backed confirmation pass during upgrade
