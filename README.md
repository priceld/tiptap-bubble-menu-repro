# BubbleMenu: a stale `preventHide` strands the menu on screen

Minimal reproduction for [ueberdosis/tiptap#6210](https://github.com/ueberdosis/tiptap/issues/6210),
by a route the issue does not yet describe: no `<select>`, no popover, and no custom
`shouldShow` — just two clicks inside the menu.

Tested against `@tiptap/extension-bubble-menu@3.31.3`. The relevant code is unchanged on `main`.

```sh
npm install
npm run dev
```

## Note on styling

`#menu` is given `position: absolute; visibility: hidden` in CSS. The vanilla `BubbleMenu`
extension does not set the element's initial styles the way the React wrapper does, so
without it the menu is visible in the page on load and floating-ui mispositions it on the
first show. Presentation only — it has no bearing on the bug below.

## Steps

1. Select some text in the editor. The bubble menu appears.
2. Click **Button A** in the menu. Focus moves into the menu and the menu stays open.
   Correct: `mousedown` set `preventHide`, and the blur it caused consumed the flag.
3. Click **Button B** in the menu. The editor is *already* blurred, so this `mousedown`
   sets `preventHide` again with no blur to consume it. **The flag is now stale.**
4. Press <kbd>Escape</kbd>. Focus returns to the editor with the selection intact and the
   menu stays open.
5. Click the dashed area outside the editor.

**Expected:** the menu hides.
**Actual:** the menu stays visible, and the on-page log records no `hide`.

**Control:** reload and do steps 1 and 5 only. The menu hides correctly, which isolates the
stale flag as the cause rather than anything about the click target.

## Mechanism

`preventHide` is written in exactly one place and cleared in exactly one other:

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
hold for a second click, because the editor is no longer focused and so cannot blur again. The
flag then survives until the next real blur, which it swallows — and because a blur changes
neither the selection nor the document, `updateHandler` early-returns on `isSame` and
`shouldShow` is never consulted, so nothing else hides the menu either.

Anything that puts focus in the menu and then returns it to the editor without a further
mousedown reaches the same state; <kbd>Escape</kbd> is simply the smallest way to show it.

## Suggested fixes

Any one of these breaks the assumption safely:

- Clear `preventHide` on `mouseup`/`click` rather than relying on a blur to arrive.
- Only set it when the editor actually has focus (`view.hasFocus()`), since its purpose is to
  survive the blur that the mousedown is about to cause.
- Drop the flag and rely on `event.relatedTarget`, which `blurHandler` already checks two
  lines later — this is the approach [#6210](https://github.com/ueberdosis/tiptap/issues/6210)
  proposes, and it makes the flag redundant.

## Workaround

Hide via the plugin's `hide` meta, which `transactionHandler` handles and `preventHide` does
not gate:

```ts
editor.on('blur', ({ event }) => {
  if (focusIsStillInsideYourEditorUi(event?.relatedTarget)) return;
  editor.view.dispatch(editor.state.tr.setMeta(bubbleMenuPluginKey, 'hide'));
});
```
