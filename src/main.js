import { Editor, getMarkRange } from "@tiptap/core";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import Document from "@tiptap/extension-document";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import "./style.css";

const menu = document.createElement("div");
menu.className = "menu";
menu.innerHTML =
  "<label>Link text <input /></label> <button>Apply</button>";
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
  element: document.getElementById("editor"),
  extensions: [
    Document,
    Paragraph,
    Text,
    Link.configure({ openOnClick: false }),
    BubbleMenu.configure({
      element: menu,
      updateDelay: 0,
      options: { placement: "bottom", onShow, onHide },
      shouldShow: ({ editor, view, element }) =>
        editor.isActive("link") &&
        (view.hasFocus() || element.contains(document.activeElement)),
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

// The same pattern as Tiptap's table column resizing: a plugin that exists only while the
// editor has focus. Any registerPlugin call during the focus event triggers the bug.
const extraKey = new PluginKey("onlyWhileFocused");
const registerOnFocus = document.getElementById("register-on-focus");
editor.on("focus", () => {
  if (
    registerOnFocus.checked &&
    !editor.state.plugins.some((p) => p.spec.key === extraKey)
  ) {
    editor.registerPlugin(new Plugin({ key: extraKey }));
  }
});
editor.on("blur", ({ event }) => {
  if (!menu.contains(event.relatedTarget))
    editor.unregisterPlugin(extraKey);
});

document.getElementById("reset").addEventListener("click", () => {
  editor.unregisterPlugin(extraKey);
  editor.view.dispatch(editor.state.tr.setMeta("bubbleMenu", "hide"));
  let linkPos = -1;
  editor.state.doc.descendants((node, pos) => {
    if (linkPos < 0 && node.marks.some((m) => m.type.name === "link")) {
      linkPos = pos;
    }
  });
  // A few characters into the link text.
  editor.commands.setTextSelection(linkPos + 3);
});

const status = document.getElementById("status");
const describe = (el) =>
  el === input
    ? "the input in the bubble menu"
    : el === document.body
      ? "body"
      : el.tagName.toLowerCase();
const render = () => {
  const el = document.activeElement;
  const cls = el === input ? "good" : el === document.body ? "bad" : "";
  status.innerHTML =
    `Focus is on: <span class="${cls}">${describe(el)}</span>\n` +
    `Bubble menu showing: ${menu.isConnected}`;
};
document.addEventListener("focusin", render);
document.addEventListener("focusout", () => setTimeout(render));
// Moving a focused element drops its focus without a focusout event, so poll as well.
setInterval(render, 100);
render();
