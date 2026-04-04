# Event Schema Registry

- `envelopes/`: envelope schema (common envelope + per-event envelope).
- `payloads/`: payload schema for each event.

Runtime validation must validate envelope schema first, then payload implicitly via envelope `$ref`.
