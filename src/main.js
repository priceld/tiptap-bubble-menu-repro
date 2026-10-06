import { setUpBubbleMenu } from "./bubble-menu.js";
import { setUpFloatingMenu } from "./floating-menu.js";
import "./style.css";

setUpBubbleMenu();
setUpFloatingMenu();

const tabs = document.querySelectorAll('[role="tab"]');
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute("aria-selected", String(selected));
      document.getElementById(other.getAttribute("aria-controls")).hidden =
        !selected;
    }
  });
}
