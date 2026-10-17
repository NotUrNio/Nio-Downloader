# Desktop Kit

Desktop interaction component library for Nio Downloader. Provides virtual scrolling lists, marquee selection, and multi-selection adaptable to arbitrary list data types.

## Architecture

Three independent modules + one glue hook:

```
                    Consumer Code
                         |
                useSelectableList (glue hook)
                /        |         \
    VirtualList    MarqueeOverlay   SelectionEngine
         |               |                |
  @tanstack/virtual   DOM events     Zustand store
                                   (pure logic, zero DOM)
```

- **SelectionEngine** — Pure logic Zustand store, zero DOM/React dependencies, independently testable
- **VirtualList** — `@tanstack/react-virtual` wrapper, agnostic of selection
- **MarqueeOverlay** — Marquee selection UI overlay, outputs index ranges only
- **useSelectableList** — Composition point wiring all three pieces together

## Quick Start

```tsx
import { useSelectableList } from './hooks/use-selectable-list'
import { VirtualList } from './virtual-list/virtual-list'
import { MarqueeOverlay } from './marquee-selection/marquee-overlay'

interface Task {
  id: string
  name: string
}

function TaskList({ tasks }: { tasks: Task[] }) {
  const {
    listRef,
    listProps,
    marqueeProps,
    getRowProps,
    headerCheckbox,
    onKeyDown,
  } = useSelectableList({
    items: tasks,
    getId: (t) => t.id,
    rowHeight: 40,
  })

  return (
    <div onKeyDown={onKeyDown} tabIndex={0} style={{ position: 'relative' }}>
      <VirtualList
        ref={listRef}
        {...listProps}
        style={{ height: 500 }}
        renderHeader={() => (
          <div>
            <input
              type="checkbox"
              checked={headerCheckbox.checked}
              ref={(el) => {
                if (el) el.indeterminate = headerCheckbox.indeterminate
              }}
              onChange={headerCheckbox.onChange}
            />
            Name
          </div>
        )}
        renderRow={({ item, index }) => {
          const rp = getRowProps(index)
          return (
            <div
              style={{ background: rp.selected ? '#dbeafe' : 'transparent' }}
              onClick={rp.onClick}
            >
              <input
                type="checkbox"
                checked={rp.selected}
                onChange={() => {}}
                onClick={(e) => {
                  e.stopPropagation()
                  rp.onCheckboxChange()
                }}
              />
              {item.name}
            </div>
          )
        }}
      />
      <MarqueeOverlay {...marqueeProps} />
    </div>
  )
}
```

## API Reference

### `useSelectableList<T>(options)`

Glue hook providing all interaction capabilities in a single call.

#### Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `items` | `T[]` | Required | List dataset |
| `getId` | `(item: T) => string` | Required | Extracts a unique ID from an item |
| `rowHeight` | `number` | Required | Fixed row height (px) |
| `headerHeight` | `number` | `0` | Header height (for marquee coordinate offset) |
| `marquee` | `boolean` | `true` | Whether marquee selection is enabled |

#### Return Value

| Field | Type | Description |
|-------|------|-------------|
| `listRef` | `RefObject<VirtualListHandle>` | Ref passed to `VirtualList` |
| `listProps` | `{ items, getId, rowHeight, scrollRef }` | Props spread to `VirtualList` |
| `marqueeProps` | `MarqueeOverlayProps` | Props spread to `MarqueeOverlay` |
| `selection` | `SelectionStore<T>` | Zustand store for fine-grained subscriptions |
| `getRowProps(index)` | `(index: number) => RowProps` | Row-level interaction props |
| `headerCheckbox` | `HeaderCheckboxState` | Header select-all checkbox state |
| `onKeyDown` | `(e: KeyboardEvent) => void` | Keydown handler bound to container |

#### `getRowProps(index)` Return Value

| Field | Description |
|-------|-------------|
| `selected` | Whether row is selected |
| `focused` | Whether row has keyboard focus |
| `onClick` | Row click handler (supports Ctrl/Cmd/Shift modifiers) |
| `onCheckboxChange` | Checkbox toggle (does not affect other selected items) |

#### `headerCheckbox` Return Value

| Field | Description |
|-------|-------------|
| `checked` | `true` when all items are selected |
| `indeterminate` | `true` when some items are selected |
| `onChange` | Toggle select all / deselect all |

### `VirtualList<T>`

Generic virtual scrolling list with fixed row height, rendered via `renderRow`.

#### Props

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `items` | `T[]` | Required | List data |
| `getId` | `(item: T) => string` | Required | Unique ID getter |
| `rowHeight` | `number` | Required | Fixed row height |
| `overscan` | `number` | `5` | Overscan count outside viewport |
| `scrollRef` | `RefObject<HTMLDivElement>` | — | External scroll container ref |
| `renderRow` | `(props: RowRenderProps<T>) => ReactNode` | Required | Row render callback |
| `renderHeader` | `() => ReactNode` | — | Header slot |
| `renderEmpty` | `() => ReactNode` | — | Empty state slot |
| `className` | `string` | — | Container CSS class |
| `style` | `CSSProperties` | — | Inline style (**height is required**) |

#### Ref Handle (`VirtualListHandle`)

| Method | Description |
|--------|-------------|
| `scrollToIndex(index)` | Scroll to specified row |
| `getScrollOffset()` | Current scroll offset |
| `getContainerRef()` | DOM reference to scroll container |

### `MarqueeOverlay`

Marquee selection overlay layer. Bound to scroll container, draws selection rectangle on drag and outputs index range.

### `createSelectionStore<T>(getId)`

Zustand store factory for SelectionEngine.

## Directory Structure

```
desktop-kit/
├── selection/
│   ├── types.ts                         # SelectionState<T>, SelectionStore<T>
│   ├── create-selection-store.ts        # Zustand store factory
│   └── create-selection-store.test.ts   # Unit tests
├── virtual-list/
│   ├── types.ts                         # VirtualListProps<T>, Handle
│   ├── virtual-list.tsx                 # @tanstack/react-virtual wrapper
│   └── virtual-list.test.tsx            # Component tests
├── marquee-selection/
│   ├── types.ts                         # MarqueeOverlayProps, DragState
│   ├── use-auto-scroll.ts               # Edge auto-scroll hook
│   ├── marquee-overlay.tsx              # Marquee UI overlay
│   └── marquee-overlay.test.tsx         # Component tests
├── hooks/
│   ├── use-selectable-list.ts           # Glue hook
│   └── use-selectable-list.test.tsx     # Integration tests
└── demo/
    └── selectable-list-demo.tsx         # Interactive demo page
```

## Design Principles

1. **Three-layer Decoupling** — SelectionEngine is DOM-agnostic, VirtualList is selection-agnostic, MarqueeOverlay outputs indices only.
2. **Generic Adaptability** — `<T>` + `getId` adapts to arbitrary data structures.
3. **Math Calculations over DOM Queries** — Calculates indices via `Math.floor(offset / rowHeight)`.
4. **Fixed Row Height** — Enables O(1) index calculation.
5. **O(1) ID Lookups** — Maintains `Map<id, index>` internally.
