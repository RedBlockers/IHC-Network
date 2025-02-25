/**
 * Class representing a context menu.
 */
export class ContextMenu {
    /**
     * Create a context menu.
     * @param {HTMLElement} target - The target element to attach the context menu to.
     * @param {HTMLElement} contextMenu - The context menu element.
     *
     * @example
     * const contextMenu = new ContextMenu(targetElement, contextMenuElement);
     * contextMenu.addContextAction('Delete', () => {
     *    console.log('Delete action clicked');
     * });
     */
    constructor(target, contextMenu) {
        this.target = target;
        this.actions = [];
        this.contextMenu = contextMenu;

        target.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            LoadContextActions(this);
            const { clientX: mouseX, clientY: mouseY } = event;

            // Position the menu
            contextMenu.style.left = `${mouseX}px`;
            contextMenu.style.top = `${mouseY}px`;
            contextMenu.style.display = "block";
        });

        // Hide the menu when clicking elsewhere
        document.addEventListener("click", () => {
            contextMenu.style.display = "none";
        });
    }

    /**
     * Add an action to the context menu.
     * @param {string} label - The label of the action.
     * @param {Function} action - The function to execute when the action is selected.
     * @param {Object} [customStyles={}] - Optional object of custom CSS properties to apply to the action button.
     *
     * @example
     * const contextMenu = new ContextMenu(targetElement, contextMenuElement);
     * contextMenu.addContextAction('Delete', () => {
     *     console.log('Delete action clicked');
     * }, { color: 'red' });
     */
    addContextAction(label, action, customStyles = {}) {
        this.actions.push({
            label: label,
            action: action,
            customStyles: customStyles,
        });
    }
}

function LoadContextActions(ContextMenu) {
    ContextMenu.contextMenu.innerHTML = "";
    ContextMenu.actions.forEach((action) => {
        const actionElement = document.createElement("button");
        actionElement.innerText = action.label;
        actionElement.classList.add("dropdown-item", "text-white");
        actionElement.style.backgroundColor = "#0a0c17";
        Object.keys(action.customStyles).forEach((style) => {
            actionElement.style.setProperty(
                style,
                action.customStyles[style],
                "important"
            );
        });
        actionElement.addEventListener("click", action.action);
        ContextMenu.contextMenu.appendChild(actionElement);
    });
}
