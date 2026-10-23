# SPEC-i18n-a11y

Status: Approved
Owner: Frontend + Training + Clinical
Depends on: pwa-privacy

## Objective

Make the pilot usable by Hindi-speaking ANMs and accessible to users with low vision, motor, or screen-reader needs.

## Scope

- Hindi and English string catalogs.
- Clinical glossary and validation messages.
- WCAG 2.1 AA.
- Keyboard, focus, contrast, zoom, screen-reader checks.

## Non-goals

- Additional languages in v1.
- Native app localization.

## Functional requirements

- `FR-I18N-001`: all pilot ANM/CHO strings are externalized; no hardcoded clinical labels.
- `FR-I18N-002`: locale follows the user preference with English fallback.
- `FR-I18N-003`: dates, numbers, and pluralization use locale-aware formatting.
- `FR-I18N-004`: Hindi clinical terms are reviewed by the clinical lead.
- `FR-I18N-005`: `<html lang>` reflects the active locale.
- `FR-A11Y-001`: zero critical/serious axe violations on pilot pages.
- `FR-A11Y-002`: keyboard-only completion of registration, visit, and referral.
- `FR-A11Y-003`: focus visible, labels programmatic, errors announced.
- `FR-A11Y-004`: color contrast >= 4.5:1; 200% zoom supported.
- `FR-A11Y-005`: TalkBack and NVDA smoke scripts pass.

## Testing

- String catalog completeness test.
- Hindi/English snapshot or text assertions for core flows.
- Axe on login, dashboard, patient, visit, referral, admin.
- Manual keyboard and screen-reader checklist.

## Success criteria

- ANM can complete registration fully in Hindi.
- Zero critical/serious accessibility findings.
- Clinical glossary approved.

## Boundaries

Always: label controls. Ask first: new locales. Never: rely on color alone.
