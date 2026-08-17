> **Primary convention (unified knowledge base)**: technical-spec templates and outputs are maintained in `/.Knowledge/template/` and `/.Knowledge/req-docs/`.

# Technical Spec Template

> For use by the **f2s-req-tech** skill. The primary template path is `.Knowledge/template/technical-spec-template.md`; configuration roots no longer receive a duplicate `template/` copy. **Sections are optional building blocks**: omit entire sections that do not apply to the requirement, and add project-specific sections as needed. The section order below is recommended and may be adjusted. Do not force API, database, error-code, or message-queue sections merely to fit the template.

---

## 1. Document Title

- H1 title: `# <activity-or-requirement-name> Technical Spec`

---

## 2. Requirement Overview

- H2 title: `## Requirement Overview`
- Use unordered lists or short paragraphs to clarify: background, goals, scope, and **explicit non-goals**.

---

## 3. Key Issues Overview

- H2 title: `## Key Issues Overview`
- Technical difficulties, concurrency/consistency/performance, boundaries with existing modules, risks, and tradeoffs (a list is enough).
- **When to fill**: when technical tradeoffs require decisions; omit if there are no obvious difficulties.

---

## 4. External Dependencies and Internal Calls

- H2 title: `## External Dependencies and Internal Calls`
- Briefly list external services depended on (HTTP/RPC/third-party APIs/SDKs, etc.) and internal modules or methods that will be called (no need to expand every parameter).
- **When to fill**: when cross-module or cross-service calls exist; omit for changes contained within a single module.

---

## 5. Configuration

- H2 title: `## Configuration`
- Split subsections by configuration source (such as `### Environment Variables`, `### Configuration Files`, `### Feature Flags`), include examples, and comment field meanings.
- **When to fill**: when configuration items need to be added or changed; omit if there is no new configuration.

---

## 6. Message Queue / Event Bus (if any)

- H2 title: `## Message Queue / Event Bus`
- Split subsections by scenario (such as `### xxx Flow`) and describe producers/consumers, topic/queue names, trigger timing, consumption logic, idempotency handling, and so on.
- **When to fill**: when asynchronous messages or event-driven architecture are involved; omit if there is no message queue.

---

## 7. Delivery Units

- Name the H2 title according to the actual delivery shape (for example `## API Contract`, `## Component Design`, `## Page / Interaction`, `## Script / Tool`, `## Service Logic`, `## Data Processing`).
- **Use one H3 title per delivery unit**: `### <delivery-unit-name>` (optionally add path or type in parentheses).
- **Within each section, include as needed** (recommended order):
  1. **Business notes** (optional): prerequisites, usage scenarios, cautions.
  2. **Input / trigger**: parameter signature, request body, user action, event, scheduled task, or script parameter examples; lists or tables are acceptable.
  3. **Output / result**: response body, page state, component Props, database write result, message event, or file output description.
  4. **Field notes** (optional): table `| Field | Type | Description |`.
  5. **Processing flow** (as needed): required when business logic, state changes, cross-module calls, or exception branches are involved; omit for pure structure descriptions or static configuration.
- For units that **reuse shared capabilities**: input/output examples + "see <xxx Technical Spec>" are enough; **processing flow** may be summarized as "same as xxx logic".
- **Prohibited**: do not open a separate chapter that lists all delivery-unit flows; do not repeat each unit's step-by-step flow again at the end of the document (unless it is a full-chain **one-page-level** sequence; see the next item).

---

## 8. Call / Interaction Flow (optional, overview only)

- H2 title: `## Call Flow` or `## Interaction Flow`
- Write **only** the **call order** from the user/system perspective (for example: load configuration on page entry, then trigger submit, then show results). Do **not** repeat internal steps from each unit. If there is no need to connect multiple units, omit the whole section.

---

## 9. Error Codes / Exception Handling

- H2 title: `## Error Codes` or `## Exception Handling`
- Table: `| Error code / exception type | Description | Handling suggestion |` (keep it consistent with project conventions).
- **When to fill**: when a clear error-code system exists or unified exception-handling strategy is needed; otherwise omit.

---

## 10. Data Model / Table Design

- H2 title: `## Data Model` or `## Table Design`
- Database: each table uses `### table-display-name table_name`, with inline field notes and index notes.
- Frontend/state: use type definitions or TypeScript interface examples.
- **When to fill**: when data structures are added or changed; omit for pure logic changes.
