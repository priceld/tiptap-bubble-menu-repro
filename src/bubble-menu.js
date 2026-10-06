import { Editor, getMarkRange } from "@tiptap/core";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import Document from "@tiptap/extension-document";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { createExtraPlugin, createMenu, trackFocus } from "./shared.js";

export function setUpBubbleMenu() {
  const panel = document.getElementById("bubble-panel");
  const trigger = document.getElementById("bubble-trigger");
  const mode = () =>
    panel.querySelector('input[name="bubble-mode"]:checked').value;

  const menu = createMenu(
    "<label>Link text <input /></label> <button>Apply</button>",
  );
  const input = menu.querySelector("input");
  const apply = menu.querySelector("button");

  const linkRange = (state) =>
    getMarkRange(
      state.doc.resolve(state.selection.from),
      state.schema.marks.link,
    );

  // Seed the input and move focus into it once each time the menu opens.
  let open = false;
  const onShow = () => {
    if (open) return;
    open = true;
    const range = linkRange(editor.state);
    input.value = range
      ? editor.state.doc.textBetween(range.from, range.to)
      : "";
    input.focus();
    input.select();
  };
  const onHide = () => {
    open = false;
  };

  const editor = new Editor({
    element: document.getElementById("bubble-editor"),
    extensions: [
      Document,
      Paragraph,
      Text,
      Link.configure({ openOnClick: false }),
      // updateDelay is left at its default of 250ms, which the update
      // debounce scenario relies on.
      BubbleMenu.configure({
        element: menu,
        options: { placement: "bottom", onShow, onHide },
        // The update debounce scenario opens the menu only for a range
        // selection, so the first click of the double-click does not open it.
        shouldShow: ({ editor, state, view }) =>
          editor.isActive("link") &&
          (mode() === "focus" || !state.selection.empty) &&
          (view.hasFocus() || menu.contains(document.activeElement)),
      }),
    ],
    content:
      '<p>Read the <a href="https://tiptap.dev">Tiptap docs</a> for more.</p>',
  });

  const applyLinkText = () => {
    const range = linkRange(editor.state);
    if (!range || !input.value) return;
    const { href } = editor.getAttributes("link");
    editor
      .chain()
      .focus()
      .insertContentAt(range, {
        type: "text",
        text: input.value,
        marks: [{ type: "link", attrs: { href } }],
      })
      .run();
  };
  apply.addEventListener("click", applyLinkText);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyLinkText();
    } else if (event.key === "Escape") {
      editor.commands.focus();
    }
  });

  const extra = createExtraPlugin(editor, "triggersTheBug");
  editor.on("focus", () => {
    if (trigger.checked && mode() === "focus") {
      // This triggers the bug. Registering a plugin makes ProseMirror destroy
      // and recreate every plugin view, the bubble menu's included. The
      // destroyed view's focus timer still fires and re-appends the menu,
      // which drops focus from its input.
      extra.register();
    }
  });
  editor.on("selectionUpdate", () => {
    if (mode() !== "update") return;
    if (editor.state.selection.empty) {
      extra.unregister();
    } else if (trigger.checked) {
      // This triggers the bug. Registering a plugin destroys the bubble menu's
      // view while its update debounce is pending. The destroyed view still
      // acts on the selection when the delay ends, and re-appends the menu,
      // which drops focus from its input.
      extra.register();
    }
  });
  editor.on("blur", ({ event }) => {
    if (!menu.contains(event.relatedTarget)) extra.unregister();
  });

  const reset = () => {
    extra.unregister();
    editor.view.dispatch(editor.state.tr.setMeta("bubbleMenu", "hide"));
    let linkPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (linkPos < 0 && node.marks.some((m) => m.type.name === "link")) {
        linkPos = pos;
      }
    });
    if (mode() === "focus") {
      // A few characters into the link, without focusing the editor.
      editor.commands.setTextSelection(linkPos + 3);
    } else {
      // Outside the link, with the editor focused, so the double-click does
      // not focus it. Focusing restores the saved selection, which would
      // replace the word the double-click selects. view.focus() rather than
      // the focus command, which waits a frame.
      editor.commands.setTextSelection(1);
      editor.view.focus();
    }
  };
  document.getElementById("bubble-reset").addEventListener("click", reset);

  for (const radio of panel.querySelectorAll('input[name="bubble-mode"]')) {
    radio.addEventListener("change", () => {
      for (const el of panel.querySelectorAll("[data-mode]")) {
        el.hidden = el.dataset.mode !== mode();
      }
      reset();
    });
  }

  trackFocus(document.getElementById("bubble-status"), menu, input);
}
