// Page chrome only — no bearing on the reproductions below.

const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

const select = (tab: HTMLButtonElement) => {
  for (const other of tabs) {
    const selected = other === tab;
    other.setAttribute('aria-selected', String(selected));
    other.tabIndex = selected ? 0 : -1;
    document.getElementById(other.getAttribute('aria-controls')!)!.hidden = !selected;
  }
};

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => select(tab));
  tab.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;

    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    select(next);
    next.focus();
  });
});
