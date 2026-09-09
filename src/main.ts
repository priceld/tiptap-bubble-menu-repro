import { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import StarterKit from '@tiptap/starter-kit';
import './tabs';

const logEl = document.querySelector<HTMLDivElement>('#log')!;
const log = (message: string) => {
  logEl.textContent += `${new Date().toISOString().slice(11, 23)}  ${message}\n`;
};

const menu = document.querySelector<HTMLDivElement>('#menu')!;

const editor = new Editor({
  element: document.querySelector<HTMLDivElement>('#editor')!,
  content: '<p>Select some of this text to bring up the bubble menu.</p>',
  extensions: [
    StarterKit,
    // Stock configuration: no custom `shouldShow`, so the plugin's default is used.
    BubbleMenu.configure({
      element: menu,
      options: {
        onShow: () => log('show'),
        onHide: () => log('hide'),
      },
    }),
  ],
});

// The menu's buttons do nothing, so that clicking them cannot affect the repro. Only their
// `mousedown` matters: it is what sets `preventHide` in the plugin.
document.querySelector('#a')!.addEventListener('click', () => log('clicked Button A (no-op)'));
document.querySelector('#b')!.addEventListener('click', () => log('clicked Button B (no-op)'));

// Escape returns focus to the editor without collapsing the selection, so the menu stays
// eligible to show. Without this the repro would end early: clicking back into the text
// collapses the selection, and the default `shouldShow` then hides the menu legitimately.
menu.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  log('Escape: returning focus to the editor');
  editor.commands.focus();
});

editor.on('blur', ({ event }) => {
  const to = event?.relatedTarget instanceof Element ? event.relatedTarget.id || '<unnamed>' : 'null';
  log(`editor blur (relatedTarget: ${to})`);
});
editor.on('focus', () => log('editor focus'));

log('ready — follow the steps above');
