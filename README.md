# BubbleMenu: two ways the menu gets stranded on screen

Two independent defects with the same symptom &mdash; the bubble menu cannot be dismissed by
clicking outside the editor. Stock configuration: no custom `shouldShow`.

Related to [ueberdosis/tiptap#6210](https://github.com/ueberdosis/tiptap/issues/6210). That
issue names `preventHide` as the cause, which accounts for Bug 2 below but not Bug 1 — and
Bug 1 is the one its description actually matches (*"if you click on a select but select
nothing, the toolbar will stay open, requiring manual focusout event handlers on each
button"*).

Tested against `@tiptap/extension-bubble-menu@3.31.3`. `mousedownHandler`, `blurHandler` and
`updateHandler` are unchanged on `main`.

```sh
npm install
npm run dev
```

Reload between the two sequences. The on-page log tells them apart: **Bug 1 logs one
`editor blur`**, **Bug 2 logs two**.

## Bug 1 — nothing listens for focus leaving the menu

1. Select some text in the editor. The bubble menu appears.
2. Click **Button A**. Focus moves into the menu and the menu stays open, which is correct.
3. Click the dashed area outside the editor.

**Expected:** the menu hides. **Actual:** it stays.

The content element lost focus at step 2, so it cannot blur again. `blurHandler` is bound to
`editor.on('blur')` and `BubbleMenuView` installs no `focusout` listener on its element, so
**step 3 runs no code at all**. `shouldShow` is not consulted either: the click changes
neither the selection nor the document, so `updateHandler` early-returns on `isSame`.

`preventHide` is not involved. It was set by the `mousedown` at step 2 and consumed by the
blur that followed; and even had it not been, that blur's `relatedTarget` was inside
`element.parentNode`, so the next check would have returned early anyway.

**Control:** reload, then do steps 1 and 3 only. The menu hides correctly, ruling out the
click target.

Real menus mask this, because a button that runs an editor command usually calls `.focus()`
and bounces focus back to the content. Anything that leaves focus *in* the menu reaches it: a
select, a dropdown, a disabled control, a no-op. The buttons here are deliberately no-ops.

## Bug 2 — a stale `preventHide` swallows a real blur

Reload first.

1. Select some text in the editor. The bubble menu appears.
2. Click **Button A**. `mousedown` set `preventHide`, and the blur it caused consumed it.
3. Click **Button B**. The content is *already* blurred, so this `mousedown` sets
   `preventHide` again with no blur to consume it. **The flag is now stale.**
4. Press <kbd>Escape</kbd>. Focus returns to the content with the selection intact and the
   menu stays open.
5. Click the dashed area.

**Expected:** the menu hides. **Actual:** it stays.

Unlike Bug 1 a real blur *does* arrive here — the log shows a second `editor blur` — and the
stale flag makes `blurHandler` return before reaching `hide()`:

```ts
mousedownHandler = () => {
  this.preventHide = true          // set on any mousedown in the menu
}

blurHandler = ({ event }) => {
  if (this.editor.isDestroyed) { this.destroy(); return }

  if (this.preventHide) {
    this.preventHide = false       // the only place it is cleared
    return
  }
  // ...
  this.hide()
}
```

The flag assumes every `mousedown` in the menu is followed by an editor blur that consumes
it. That holds for the first click, which moves focus out of the content element. It does not
hold for a second, because the editor is no longer focused and cannot blur again.

## The two are independent

Neither fix covers the other:

| Fix | Bug 1 | Bug 2 |
| --- | --- | --- |
| add a `focusout` listener on the menu element | fixed | **not** fixed — at step 5 focus is on the content, not in the menu, so no menu `focusout` fires |
| clear `preventHide` on mouseup, or only set it when the editor has focus | **not** fixed — no blur fires at all, so there is no event for the flag to affect | fixed |

## One fix for both

Both exist because visibility is recomputed only on a selection or document change, so a
plain focus change never re-asks `shouldShow`. **Re-evaluating `shouldShow` on focus changes
fixes both**, and makes `preventHide` dead code, because the default `shouldShow` already
computes exactly what the flag protects:

```ts
const isChildOfMenu = this.element.contains(document.activeElement)
const hasEditorFocus = view.hasFocus() || isChildOfMenu
if (!hasEditorFocus || empty || isEmptyTextBlock || !this.editor.isEditable) return false
```

One caveat for the implementation: on `blur`, `document.activeElement` is `<body>` before
focus lands, so a synchronous re-evaluation would wrongly hide when focus is heading *into*
the menu. It needs to key off `relatedTarget` or defer a tick — `focusHandler` already does
`setTimeout(() => this.update(...))` for much the same reason.

## Workaround

Hide via the plugin's `hide` meta, which `transactionHandler` handles and `preventHide` does
not gate. Both sources are needed, one per bug:

```ts
const hide = () => editor.view.dispatch(editor.state.tr.setMeta(bubbleMenuPluginKey, 'hide'));

// Bug 1: focus leaving the menu.
menuElement.addEventListener('focusout', (e) => {
  if (focusIsStillInsideYourEditorUi(e.relatedTarget)) return;
  hide();
});

// Bug 2: focus leaving the content, where a stale flag may swallow the plugin's own blur.
editor.on('blur', ({ event }) => {
  if (focusIsStillInsideYourEditorUi(event?.relatedTarget)) return;
  hide();
});
```

## Note on styling

`#menu` is given `position: absolute; visibility: hidden` in CSS. The vanilla `BubbleMenu`
extension does not set the element's initial styles the way the React wrapper does, so
without it the menu is visible in the page on load and floating-ui mispositions it on the
first show. Presentation only, with no bearing on either bug.
