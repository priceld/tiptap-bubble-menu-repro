import { Plugin, PluginKey } from "@tiptap/pm/state";

/** Creates a detached menu element. The menu's plugin appends it when it shows. */
export function createMenu(html) {
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.innerHTML = html;
  return menu;
}

/**
 * An empty plugin that a scenario registers and removes to change the editor's
 * plugin list, which makes ProseMirror destroy and recreate every plugin view.
 */
export function createExtraPlugin(editor, name) {
  const key = new PluginKey(name);
  const isRegistered = () =>
    editor.state.plugins.some((plugin) => plugin.spec.key === key);
  return {
    register() {
      if (!isRegistered()) editor.registerPlugin(new Plugin({ key }));
    },
    unregister() {
      if (isRegistered()) editor.unregisterPlugin(key);
    },
  };
}

/** Keeps a status line showing where focus is and whether the menu is showing. */
export function trackFocus(status, menu, input) {
  const describe = (el) =>
    el === input
      ? "the input in the menu"
      : el === document.body
        ? "body"
        : el.tagName.toLowerCase();
  const render = () => {
    const el = document.activeElement;
    const cls = el === input ? "good" : el === document.body ? "bad" : "";
    status.innerHTML =
      `Focus is on: <span class="${cls}">${describe(el)}</span>\n` +
      `Menu showing: ${menu.isConnected}`;
  };
  document.addEventListener("focusin", render);
  document.addEventListener("focusout", () => setTimeout(render));
  // Moving a focused element drops its focus without a focusout event, so poll as well.
  setInterval(render, 100);
  render();
}
