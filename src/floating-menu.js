import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import FloatingMenu from "@tiptap/extension-floating-menu";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { createExtraPlugin, createMenu, trackFocus } from "./shared.js";

export function setUpFloatingMenu() {
  const trigger = document.getElementById("floating-trigger");

  const menu = createMenu(
    '<label>Prompt <input placeholder="Type, then press Enter" /></label>',
  );
  const input = menu.querySelector("input");

  // Move focus into the input once each time the menu opens.
  let open = false;
  const onShow = () => {
    if (open) return;
    open = true;
    input.value = "";
    input.focus();
  };
  const onHide = () => {
    open = false;
  };

  const editor = new Editor({
    element: document.getElementById("floating-editor"),
    extensions: [
      Document,
      Paragraph,
      Text,
      FloatingMenu.configure({
        element: menu,
        options: { placement: "right", onShow, onHide },
        // The default check, plus staying open while focus is in the menu.
        shouldShow: ({ state, view }) => {
          const { $anchor, empty } = state.selection;
          return (
            empty &&
            $anchor.parent.isTextblock &&
            $anchor.parent.childCount === 0 &&
            (view.hasFocus() || menu.contains(document.activeElement))
          );
        },
      }),
    ],
    content:
      "<p>Some text before the empty line.</p><p></p><p>Some text after it.</p>",
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (input.value) editor.chain().focus().insertContent(input.value).run();
    } else if (event.key === "Escape") {
      editor.commands.focus();
    }
  });

  const extra = createExtraPlugin(editor, "triggersTheBug");
  editor.on("focus", () => {
    if (trigger.checked) {
      // This triggers the bug. Registering a plugin makes ProseMirror destroy
      // and recreate every plugin view, the floating menu's included. The
      // destroyed view's focus timer still fires and re-appends the menu,
      // which drops focus from its input.
      extra.register();
    }
  });
  editor.on("blur", ({ event }) => {
    if (!menu.contains(event.relatedTarget)) extra.unregister();
  });

  document.getElementById("floating-reset").addEventListener("click", () => {
    extra.unregister();
    editor.view.dispatch(editor.state.tr.setMeta("floatingMenu", "hide"));
    let emptyLinePos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (emptyLinePos < 0 && node.isTextblock && node.childCount === 0) {
        emptyLinePos = pos;
      }
    });
    editor.commands.setTextSelection(emptyLinePos + 1);
  });

  trackFocus(document.getElementById("floating-status"), menu, input);
}
