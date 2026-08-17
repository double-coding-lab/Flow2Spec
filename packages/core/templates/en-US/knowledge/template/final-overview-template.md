> **Primary convention (unified knowledge base)**: final-draft templates and final documents are maintained in `.Knowledge/template/` and `.Knowledge/stock-docs/`.

# Final Overview Template

> This template organizes documents such as "architecture notes" and "feature/technical specs" into a **final-draft** form so the **f2s-kb-build** skill can update `.Knowledge/topics`, `.Knowledge/index.md`, and, as needed, the routing manifest (`manifest-routing` + `matchers/*.json`).  
> Applies to backend services, frontend/client, full-stack, product, design notes, and similar documents. Keep or omit sections as needed.  
> **In Flow2Spec**: the primary template path is `.Knowledge/template/final-overview-template.md`; configuration roots no longer receive a duplicate `template/` copy.  
> **When executing the f2s-doc-final skill**: this template is only a **structural reference and writing prompt**, not a mandatory form. Conversion should primarily follow the original content and logic, adopting section suggestions as needed.

---

## Core Concepts

| Concept | Description |
|------|------|
| (Term 1) | Definition and purpose. |
| (Term 2) | Definition and purpose. |

Use a table to list **terms, entities, and key IDs** so AI can extract them into Rules/Skills. For architecture notes, include directory conventions, module boundaries, shared capability entry points, and similar items. For feature specs, include domain entities, configuration keys, API/page names, and similar items.

---

## States and Transitions

(Fill this if there are states, phases, or lifecycle steps; otherwise summarize briefly or omit.)

- **State A**: meaning; when it transitions to state B/C.
- **State B**: meaning; later transitions.

If there is no complex state model, write "phases in the main flow" or "this document has no state machine; see key flows".

---

## Business Rules

- Rule 1: constraints, purchase limits, validity windows, permissions, and so on.
- Rule 2: validation dimensions, failure conditions, edge cases.
- Rule 3: relationships to configuration, flags, and environments.

Clarify **constraints, validations, and configuration items** so Rules can generate "rule highlights". Frontend/backend behavior, configuration, data consistency, error handling, and similar items may all be listed here.

---

## Key Flows

1. **Flow 1**: brief steps; entry point (interface/API/page/event); result.
2. **Flow 2**: brief steps; entry point; result.
3. **Flow 3**: brief steps; entry point; result.

Write the main flow from the "user side or system side" so AI can extract it into the "key flows" section of Skills. May include API call order, page navigation, event triggers, background tasks, and similar items.

---

## Interfaces / APIs / Pages (optional)

(Choose one or more based on document type: backend writes interfaces, frontend writes pages/components and data flow, full-stack can include both.)

### Interface / API Name or Path

- **Request**: input parameters (body/query/header).
- **Response**: output parameters; error codes or exception cases.
- **Internal calls**: in-project methods, services, or modules (if any).

### Page / Component / Route (if any)

- **Entry**: route, entry component, or event.
- **Dependent data**: API, Store, local state.
- **Output**: page/component responsibility and key interactions.

---

## Configuration / Data / Errors (optional)

(Include as needed; not all items must appear.)

- **Configuration**: configuration items, keys, required/optional status, meaning; configuration-center or environment-variable conventions.
- **Data**: core data model, table structure, field notes; or frontend Store/state structure; relationship to the business.
- **Error codes or exceptions**: code, scenario, description; or frontend error states and fallback logic.

---

## Implementation Location and Integration Method

- **Implementation location**: code/service/repository path (such as `src/xxx/yyy`, service name, repository name), explaining where the wrapper or implementation lives.
- **Integration method**: how new features/businesses integrate: required configuration, table creation, route registration, component references, and similar steps; the minimal integration steps when no wrapper changes are needed.

---

## Source Files

> Original paths actually read when generating this final draft, for traceability and later updates.

- `<path-1>`
- `<path-2>`

---

### Usage Notes

- Replace the placeholders in parentheses above with actual content; sections unrelated to the document type may be deleted entirely or marked "(not applicable)".
- Keep at least the three H2 headings **Core Concepts, Business Rules, Key Flows**; add or remove the rest as needed.
- After saving as `.Knowledge/stock-docs/<design-name>_final.md`, run the **f2s-kb-build** skill with that path as input to update `.Knowledge/topics`, `.Knowledge/index.md`, and the routing manifest when needed.
