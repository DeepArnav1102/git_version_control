# ⌨️ Keyboard Shortcuts — GitVersionControl

A complete reference of all planned keyboard shortcuts for the app.

---

## 🌐 Global Navigation
> Sequential shortcuts — press `G` first, then the second key.

| Shortcut | Action |
|---|---|
| `G` → `D` | Go to Dashboard |
| `G` → `P` | Go to Profile |
| `G` → `N` | New Repository |
| `G` → `S` | Go to Profile Settings |
| `G` → `R` | Go to Repositories tab |
| `G` → `I` | Go to IDE / Codespace |

---

## 🔍 Search

| Shortcut | Action |
|---|---|
| `/` | Focus search bar |
| `Ctrl + K` | Focus search bar (VS Code style alternative) |
| `@` | Focus search bar scoped to **your own repos only** |
| `↑` / `↓` | Navigate between search results |
| `Enter` | Open highlighted result |
| `Escape` | Clear & close search dropdown |

---

## 📁 Repository Page

| Shortcut | Action |
|---|---|
| `T` | Focus file tree filter input |
| `W` | Toggle left file sidebar |
| `1` | Switch to Code tab |
| `2` | Switch to Commits tab |
| `3` | Switch to Settings tab (owner only) |
| `B` | Focus branch selector |
| `S` | Toggle Star repository |
| `F` | Fork repository |
| `C` | Copy clone URL |
| `P` | Toggle Pin repository |
| `D` | Download repository as ZIP |
| `Ctrl + .` | Open repository in IDE / Codespace |

---

## 📄 File Viewer
> Active when a file is open inside the repo page.

| Shortcut | Action |
|---|---|
| `Escape` | Close file, return to directory view |
| `Y` | Copy file permalink / blob hash |
| `Ctrl + C` | Copy raw file content to clipboard |
| `[` | Navigate up to parent folder (breadcrumb back) |
| `]` | Navigate into selected folder |

---

## 🔐 Profile Page

| Shortcut | Action |
|---|---|
| `E` | Open Edit Profile modal |
| `1` | Switch to Overview tab |
| `2` | Switch to Repositories tab |
| `3` | Switch to Starred tab |
| `4` | Switch to Tokens tab |

---

## 🖥️ IDE / Codespace

| Shortcut | Action |
|---|---|
| `Ctrl + S` | Save current file |
| `Ctrl + \` | Toggle integrated terminal |
| `Ctrl + B` | Toggle file tree panel |
| `Escape` | Close active panel / modal |

---

## 💬 Modals & Toasts

| Shortcut | Action |
|---|---|
| `Escape` | Close any open modal or dropdown |
| `Enter` | Confirm dialog / Submit form |
| `N` | Dismiss active notification toast |

---

## 🎨 UI / Misc

| Shortcut | Action |
|---|---|
| `?` | Open keyboard shortcuts help modal (shows this list in-app) |
| `Ctrl + Shift + K` | Toggle dark mode (when dark mode is added) |
| `Ctrl + Shift + S` | Open navigation sidebar |

---

## 📋 Implementation Priority

### Tier 1 — High Impact (implement first)
These are shortcuts users actively expect from a GitHub-like platform:

- `/` and `Ctrl+K` → focus search
- `?` → in-app shortcuts help modal
- `G + D`, `G + N`, `G + P` → global navigation
- `Escape` → universal close for everything
- `↑ ↓ Enter` → keyboard navigation in search dropdown

### Tier 2 — Repo Power Users
- `T` → file tree filter
- `W` → toggle sidebar
- `1` / `2` / `3` → tab switching
- `S` → star repo
- `C` → copy clone URL

### Tier 3 — Polish
- `Y` → file permalink
- `[` `]` → directory navigation
- `E` → edit profile
- `D` → download ZIP

---

## 🗒️ Implementation Notes

- All shortcuts should be **disabled when focus is inside an input, textarea, or contenteditable** — check `document.activeElement.tagName` before firing.
- Sequential shortcuts (e.g. `G + D`) need a **500ms timeout** between the first and second key — reset if nothing follows.
- Use a **global `keydown` listener** in a `useKeyboardShortcuts` custom hook, registered once at the app root (`App.jsx`).
- The `?` modal should render the same table as this document — keep the data in a JS constant so it's the single source of truth.
