# Frontend UI Engineering Quality Improvements - Task List

## Phase 1: Foundation & Component Extraction

- [ ] **Task 1.1**: Create reusable Icon components library
  - Extract all inline SVG icons into \src/components/icons/\
  - Create index barrel export
  - Update all pages to use shared icons
  - **Files**: \src/components/icons/*.tsx\, update all page files
  - **Scope**: Medium
  - **Dependencies**: None

- [ ] **Task 1.2**: Create reusable RiskBadge component
  - Extract RiskBadge from Dashboard, Patients, PatientDetail, Referrals, Supervision
  - Add variants for different contexts (compact, detailed, with icon)
  - Add proper TypeScript types and accessibility attributes
  - **Files**: \src/components/RiskBadge/\, update all page files
  - **Scope**: Small
  - **Dependencies**: None

- [ ] **Task 1.3**: Create reusable FormField components
  - Create Input, Select, Textarea, Checkbox, Radio components with consistent styling
  - Add label association, error state, helper text support
  - **Files**: \src/components/FormField/\, update form-heavy pages
  - **Scope**: Medium
  - **Dependencies**: None

- [ ] **Task 1.4**: Create reusable Table components
  - Extract table structure into composable Table, TableHeader, TableRow, TableCell
  - Add sorting, pagination, empty state, loading skeleton support
  - **Files**: \src/components/Table/\, update Dashboard, Patients, Referrals, Supervision
  - **Scope**: Medium
  - **Dependencies**: Task 1.1 (icons for sort indicators)

### Checkpoint 1: After Phase 1
- [ ] All shared components extracted and exported
- [ ] All pages updated to use shared components
- [ ] \
pm run check:fast\ passes
- [ ] Visual regression: no breaking changes

## Phase 2: Accessibility Improvements

- [ ] **Task 2.1**: Fix heading hierarchy across all pages
  - Ensure single h1 per page, proper h2/h3 nesting
  - Add landmark regions (main, nav, aside)
  - **Files**: All page files, Layout.tsx
  - **Scope**: Small
  - **Dependencies**: Phase 1

- [ ] **Task 2.2**: Improve keyboard navigation and focus management
  - Ensure all interactive elements are keyboard accessible
  - Add visible focus styles (already in CSS but verify)
  - Implement focus trapping in modals/dialogs
  - **Files**: Layout.tsx, PatientDetail.tsx, NewVisit.tsx, Settings.tsx
  - **Scope**: Small
  - **Dependencies**: Phase 1

- [ ] **Task 2.3**: Add ARIA labels and semantic HTML improvements
  - Add aria-label to icon-only buttons
  - Ensure form inputs have associated labels
  - Add role=\lert\ for error messages
  - Add aria-live for dynamic content updates
  - **Files**: All interactive components
  - **Scope**: Medium
  - **Dependencies**: Phase 1

- [ ] **Task 2.4**: Improve screen reader experience
  - Add proper table headers with scope attributes
  - Ensure status updates are announced
  - Add descriptive link text (avoid \View all\ without context)
  - **Files**: Table components, Dashboard, Patients, Referrals
  - **Scope**: Small
  - **Dependencies**: Phase 1, Task 1.4

### Checkpoint 2: After Phase 2
- [ ] axe-core scan passes with zero critical/serious violations
- [ ] Keyboard navigation works for all flows
- [ ] Screen reader announces content correctly
- [ ] \
pm run check:fast\ passes

## Phase 3: Responsive Design & Polish

- [ ] **Task 3.1**: Audit and fix responsive breakpoints
  - Test at 320px, 768px, 1024px, 1440px
  - Fix any horizontal overflow issues
  - Ensure touch targets meet 44x44px minimum
  - **Files**: All page files, CSS
  - **Scope**: Medium
  - **Dependencies**: Phase 1

- [ ] **Task 3.2**: Improve loading, empty, and error states
  - Replace spinners with skeleton loaders for content
  - Add meaningful empty states with action buttons
  - Improve error messages with retry actions
  - **Files**: All pages with data fetching
  - **Scope**: Small
  - **Dependencies**: Phase 1

- [ ] **Task 3.3**: Design system consistency audit
  - Replace any hardcoded values with CSS variables
  - Ensure consistent spacing scale (0.25rem increments)
  - Verify color contrast ratios meet 4.5:1
  - **Files**: index.css, all component files
  - **Scope**: Small
  - **Dependencies**: Phase 1

### Checkpoint 3: After Phase 3
- [ ] Responsive at all breakpoints
- [ ] Loading/empty/error states improved
- [ ] Design system consistent
- [ ] \
pm run check:fast\ passes

## Phase 4: Component Decomposition

- [ ] **Task 4.1**: Decompose PatientDetail page (>300 lines)
  - Split into: PatientHeader, RiskAssessmentPanel, PatientDetailsGrid, VisitHistoryTable, PatientForm
  - Create container/presentation separation
  - **Files**: \src/components/patient/\, \src/pages/PatientDetail.tsx\
  - **Scope**: Large
  - **Dependencies**: Phase 1

- [ ] **Task 4.2**: Decompose NewVisit page (>280 lines)
  - Split into: VisitDetailsForm, VitalsGrid, DangerSignsSelector, SupplementsSelector, ReferralSection, NotesSection
  - **Files**: \src/components/visit/\, \src/pages/NewVisit.tsx\
  - **Scope**: Large
  - **Dependencies**: Phase 1

- [ ] **Task 4.3**: Decompose Dashboard page (>250 lines)
  - Split into: StatCardsGrid, HighRiskPatientsTable, UpcomingVisitsTable, SupervisionAlertsTable
  - **Files**: \src/components/dashboard/\, \src/pages/Dashboard.tsx\
  - **Scope**: Medium
  - **Dependencies**: Phase 1, Task 1.4

### Checkpoint 4: After Phase 4
- [ ] All large components decomposed (<200 lines each)
- [ ] Container/presentation pattern applied
- [ ] \
pm run check:fast\ passes
- [ ] No functionality regression

## Phase 5: Testing

- [ ] **Task 5.1**: Add unit tests for extracted components
  - Test RiskBadge variants, FormField components, Table components
  - Test icon components render correctly
  - **Files**: \src/components/**/*.test.tsx\
  - **Scope**: Medium
  - **Dependencies**: Phases 1-4

- [ ] **Task 5.2**: Add integration tests for pages
  - Test Patients page: search, filter, pagination
  - Test PatientDetail: view/edit modes, form validation
  - Test NewVisit: form submission, validation
  - **Files**: \src/pages/*.test.tsx\
  - **Scope**: Medium
  - **Dependencies**: Phases 1-4

- [ ] **Task 5.3**: Add E2E tests for critical user flows
  - Login > Dashboard > Patient list > Patient detail > New visit
  - Offline mode handling
  - Sync flow
  - **Files**: \	ests/e2e/*.spec.ts\
  - **Scope**: Large
  - **Dependencies**: Phases 1-4

### Checkpoint 5: After Phase 5
- [ ] Unit test coverage >= 80% on changed lines
- [ ] Integration tests cover key user flows
- [ ] E2E tests pass for critical paths
- [ ] \
pm run check:task\ passes

## Phase 6: Performance & Bundle Optimization

- [ ] **Task 6.1**: Code splitting and lazy loading
  - Lazy load page components
  - Split vendor chunks appropriately
  - **Files**: App.tsx, vite.config.ts
  - **Scope**: Small
  - **Dependencies**: Phase 1

- [ ] **Task 6.2**: Bundle size audit
  - Run size-limit check
  - Identify and remove unused dependencies
  - Optimize imports
  - **Files**: package.json, vite.config.ts
  - **Scope**: Small
  - **Dependencies**: Phase 1

### Checkpoint 6: After Phase 6
- [ ] Bundle size <= 170 kB gzipped
- [ ] LCP <= 2500ms, CLS <= 0.1
- [ ] \
pm run check:perf && npm run check:bundle\ passes

