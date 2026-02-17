# Floating Action Button (FAB) Components

This directory contains the refactored FAB component, broken down into smaller, more maintainable pieces.

## Structure

### Main Component
- **FloatingActionButton.tsx** - Main orchestrator component that manages state and coordinates all sub-components

### Sub-Components
- **FABButton.tsx** - The circular floating button itself (Plus/X icon)
- **FABBackdrop.tsx** - The backdrop/overlay with blur effect
- **TaskSelectionView.tsx** - Initial menu showing Task and Workspace/Post options
- **WorkspaceSelectionView.tsx** - Workspace selection list
- **PostTaskSelectionView.tsx** - Completed tasks selection list for posting

### Hooks
- **useFABAnimations.ts** - Custom hook that encapsulates all animation logic

## Component Hierarchy

```
FloatingActionButton
├── FABBackdrop (backdrop with blur)
├── Menu Container (animated)
│   ├── TaskSelectionView (state: task-selection)
│   ├── WorkspaceSelectionView (state: workspace-creation)
│   └── PostTaskSelectionView (state: post-task-selection)
└── FABButton (the + button)
```

## State Flow

1. **collapsed** → Initial state, FAB button visible
2. **task-selection** → Shows Task and Workspace/Post options
3. **workspace-creation** → Shows list of workspaces to select
4. **post-task-selection** → Shows list of completed tasks to post

## Animation Flow

All animations are managed by `useFABAnimations` hook:
- **animateOpen()** - Opens the menu from collapsed state
- **animateClose()** - Closes the menu back to collapsed state
- **animateToWorkspaceView()** - Transitions from task selection to workspace selection
- **animateToPostTaskView()** - Transitions from task selection to post task selection
- **animateBackToTaskView()** - Returns to task selection from any sub-view
- **animateFABPress()** - Subtle press animation on the FAB button
- **animateKeyboardShow/Hide()** - Handles keyboard visibility

## Benefits of Refactoring

1. **Separation of Concerns** - Each component has a single responsibility
2. **Easier Testing** - Smaller components are easier to test in isolation
3. **Better Readability** - Logic is organized and easier to follow
4. **Reusability** - Components can be reused or modified independently
5. **Maintainability** - Changes to one view don't affect others
6. **Animation Logic Isolation** - All animation logic in one hook

## Usage

```tsx
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";

<FloatingActionButton visible={!shouldHideTabBar} />
```

## Future Improvements

- Add unit tests for each component
- Extract more constants (durations, easing functions)
- Add TypeScript strict mode compliance
- Consider using React.memo for performance optimization
- Add accessibility labels and screen reader support
