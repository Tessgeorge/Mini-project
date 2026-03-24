# Workflow Rename Map

This project now uses one shared vocabulary across the main student and mentor workflow screens.

## Core Vocabulary

| Old / Mixed Label | Standard Label | Notes |
| --- | --- | --- |
| Project | Team | Use for the student group container in UI. |
| My Project | Project Overview | Keep for the detailed team/project summary page. |
| Project Team | Team | Avoid repeating both terms together. |
| Project Guide | Mentor | Use in student and mentor-facing UI. |
| Phase | Review Stage / Current Step | `Review Stage` for evaluation forms, `Current Step` for workflow progress. |
| Phase 1 | Zeroth Review | Mapped in `workflowConfig.js`. |
| Phase 2 | First Review | Mapped in `workflowConfig.js`. |
| Phase 3 | Second Review | Mapped in `workflowConfig.js`. |
| Final Pitch | Final Review | Mapped in `workflowConfig.js`. |
| Pending | Idea Pending | Project context label override in `statusConfig.js`. |
| Approved | Idea Approved | Project context label override in `statusConfig.js`. |
| Submitted | Pending Review | Submission context label override in `statusConfig.js`. |

## Standard Workflow Timeline

The shared workflow order is defined in [`workflowConfig.js`](../etnova-frontend/src/constants/workflowConfig.js):

1. Idea Approval
2. Abstract Submission
3. Zeroth Review
4. First Review
5. Second Review
6. Final Review

## Shared Config Files

- [`workflowConfig.js`](../etnova-frontend/src/constants/workflowConfig.js)
  - workflow stage aliases
  - timeline metadata
  - student/mentor navigation targets
  - workflow snapshot logic for real progress state
- [`statusConfig.js`](../etnova-frontend/src/constants/statusConfig.js)
  - shared status labels
  - pill colors
  - context-specific overrides for idea/submission/project badges
- [`studentNavigation.js`](../etnova-frontend/src/constants/studentNavigation.js)
  - standardized student navigation labels
  - quick-nav entries

## Screens Refactored In This Pass

- [`StudentDashboard.jsx`](../etnova-frontend/src/pages/StudentDashboard.jsx)
- [`Submissions.jsx`](../etnova-frontend/src/pages/Submissions.jsx)
- [`IdeaWorkspacePanel.jsx`](../etnova-frontend/src/components/IdeaWorkspacePanel.jsx)
- [`MentorDashboard.jsx`](../etnova-frontend/src/pages/MentorDashboard.jsx)
- [`Teamworkspace.jsx`](../etnova-frontend/src/pages/Teamworkspace.jsx)

## Remaining Legacy Naming To Clean Later

These screens still use older vocabulary and should be updated in a follow-up pass:

- [`MyProject.jsx`](../etnova-frontend/src/pages/MyProject.jsx)
- [`MyTeam.jsx`](../etnova-frontend/src/pages/MyTeam.jsx)
- Admin pages that still use `projects` in user-facing labels

## Implementation Rule

When adding new UI:

- use `Team` for the student group
- use `Idea` for the proposal/versioned concept
- use `Submission` for uploaded documents
- use `Review Stage` for mentor evaluation input
- use `Current Step` for timeline and progress displays
