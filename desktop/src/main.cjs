"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, desktopCapturer, Menu, shell, session, ipcMain } = require("electron");

const {
    resolveEndpoint,
    isTrustedNavigation,
    isPermissionAllowed,
    isDisplayRequestAllowed,
} = require("./security.cjs");
const { instanceEndpoint, partitionFor, readInstances, rememberInstance } = require("./instances.cjs");
const welcomeFile = path.join(__dirname, "welcome.html");

app.setAppUserModelId("fr.qweillo.desktop");

function readConfiguredUrl() {
    if (!app.isPackaged && process.env.QWEILLO_PUBLIC_URL) return process.env.QWEILLO_PUBLIC_URL;
    const configPath = path.join(app.getAppPath(), "runtime-config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.publicUrl;
}

function configureSession(endpoint, appSession) {
    appSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
        isPermissionAllowed(permission, requestingOrigin, endpoint)
    );
    appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const requestingUrl = details.requestingUrl || webContents.getURL();
        callback(isPermissionAllowed(permission, requestingUrl, endpoint));
    });
    appSession.setDisplayMediaRequestHandler(async (request, callback) => {
        if (!isDisplayRequestAllowed(request, endpoint)) return callback({});

        try {
            const sources = await desktopCapturer.getSources({
                types: ["screen", "window"],
                thumbnailSize: { width: 0, height: 0 },
                fetchWindowIcons: false,
            });
            let settled = false;
            const finish = (streams) => {
                if (settled) return;
                settled = true;
                callback(streams);
            };
            const template = sources.map((source) => ({
                label: source.name,
                click: () =>
                    finish({
                        video: source,
                        ...(request.audioRequested && process.platform === "win32" ? { audio: "loopback" } : {}),
                    }),
            }));
            template.push({ type: "separator" }, { label: "Annuler", click: () => finish({}) });
            Menu.buildFromTemplate(template).popup({ window: mainWindow, callback: () => finish({}) });
        } catch {
            callback({});
        }
    });
}

function createWindow(endpoint) {
    const partition = endpoint ? partitionFor(endpoint) : "persist:qweillo-instances";
    if (endpoint) configureSession(endpoint, session.fromPartition(partition));
    const window = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 390,
        minHeight: 600,
        backgroundColor: "#080a10",
        title: "qweillo",
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            spellcheck: true,
            partition,
            preload: path.join(__dirname, "preload.cjs"),
        },
    });

    window.once("ready-to-show", () => window.show());
    window.webContents.on("did-finish-load", () => {
        if (endpoint && isTrustedNavigation(window.webContents.getURL(), endpoint)) {
            try {
                rememberInstance(app.getPath("userData"), endpoint);
            } catch {}
        }
    });

    window.webContents.on("will-navigate", (event, target) => {
        if (!endpoint || !isTrustedNavigation(target, endpoint)) event.preventDefault();
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
        if (endpoint && isTrustedNavigation(url, endpoint)) return { action: "allow" };
        try {
            const external = new URL(url);
            if (["https:", "http:"].includes(external.protocol)) void shell.openExternal(external.toString());
        } catch {}
        return { action: "deny" };
    });

    window.webContents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
        if (isMainFrame && code !== -3 && window.webContents.getURL() !== pathToFileURL(welcomeFile).href)
            void window.loadFile(welcomeFile);
    });
    if (endpoint) void window.loadURL(endpoint).catch(() => {});
    else void window.loadFile(welcomeFile);
    return window;
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let mainWindow;
let activeEndpoint = null;

function trustedSender(event) {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame)
        return false;
    return (
        event.senderFrame.url === pathToFileURL(welcomeFile).href ||
        (activeEndpoint && isTrustedNavigation(event.senderFrame.url, activeEndpoint))
    );
}

function replaceWindow(endpoint) {
    const previous = mainWindow;
    activeEndpoint = endpoint;
    mainWindow = createWindow(endpoint);
    if (previous && !previous.isDestroyed()) previous.close();
}

app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
});

app.whenReady().then(() => {
    activeEndpoint = readInstances(app.getPath("userData")).active;
    if (!activeEndpoint) {
        try {
            activeEndpoint = resolveEndpoint({ configuredUrl: readConfiguredUrl(), isPackaged: app.isPackaged });
        } catch {}
    }
    mainWindow = createWindow(activeEndpoint);

    ipcMain.handle("qweillo:list-instances", (event) => {
        if (!trustedSender(event)) throw new Error("Requête refusée.");
        return readInstances(app.getPath("userData")).entries;
    });
    ipcMain.handle("qweillo:open-instance", (event, value) => {
        if (!trustedSender(event)) throw new Error("Requête refusée.");
        const endpoint = instanceEndpoint(value);
        rememberInstance(app.getPath("userData"), endpoint);
        setImmediate(() => replaceWindow(endpoint));
        return { opened: true };
    });
    Menu.setApplicationMenu(
        Menu.buildFromTemplate([
            {
                label: "Qweillo",
                submenu: [
                    { label: "Choisir une instance…", click: () => replaceWindow(null) },
                    { type: "separator" },
                    { role: "quit", label: "Quitter" },
                ],
            },
            {
                label: "Affichage",
                submenu: [
                    { role: "reload", label: "Actualiser" },
                    { role: "togglefullscreen", label: "Plein écran" },
                ],
            },
        ])
    );

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow(activeEndpoint);
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
