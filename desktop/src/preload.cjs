"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
    "qweillo",
    Object.freeze({
        openInstance: (origin) => ipcRenderer.invoke("qweillo:open-instance", origin),
        listInstances: () => ipcRenderer.invoke("qweillo:list-instances"),
    })
);
