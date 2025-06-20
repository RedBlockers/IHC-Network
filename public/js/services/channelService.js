import { Channels } from "/js/api/channels.js";
import { ContextMenu } from "/js/utils/contextMenuUtils.js";

export function handleChannelCreation() {
    const target = document.getElementById("secondaryContainer");
    const _contextMenu = document.getElementById("contextMenu");
    const contextMenu = new ContextMenu(target, _contextMenu);
    contextMenu.addContextAction("Ajouter un salon", () => {
        const modal = new bootstrap.Modal(
            document.getElementById("addChannelModal")
        );
        modal.show();
    });
    const addChannelAccept = document.getElementById("addChannelModalAccept");

    addChannelAccept.addEventListener("click", () => {
        const channelName = document.getElementById("channelName").value;
        const channelDescription =
            document.getElementById("channelDescription").value;
        const channelType = document.getElementById("channelType").value;
        //récupérer l'id de la guild avec regex
        const guildId = window.location.href.match(/\/(\d+)\/(\d+)/)[1];

        Channels.addChannel(
            channelType,
            channelName,
            channelDescription,
            guildId
        );
        const modal = bootstrap.Modal.getInstance(
            document.getElementById("addChannelModal")
        );
        modal.hide();
    });
}
