function LoadContextActions(ContextMenu) {
    ContextMenu.contextMenu.innerHTML = '';
    ContextMenu.actions.forEach(action => {
        const actionElement = document.createElement('button');
        actionElement.innerText = action.label;
        actionElement.classList.add('dropdown-item', 'bg-dark', 'text-white');
        actionElement.addEventListener('click', action.action);
        ContextMenu.contextMenu.appendChild(actionElement);
    });
}

export class ContextMenu {
    constructor(target, contextMenu) {
        this.target = target;
        this.actions = [];
        this.contextMenu = contextMenu;

        target.addEventListener('contextmenu', (event) => {
            event.preventDefault(); // Empêche le menu par défaut
            LoadContextActions(this);
            const { clientX: mouseX, clientY: mouseY } = event;

            // Positionner le menu
            contextMenu.style.left = `${mouseX}px`;
            contextMenu.style.top = `${mouseY}px`;
            contextMenu.style.display = 'block';
        });

        // Cacher le menu lorsqu'on clique ailleurs
        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });
    }

    addContextAction(label, action) {
        this.actions.push({label: label, action: action});
     }
}