const { app, BrowserWindow, session, Notification, ipcMain, Tray, Menu, shell, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;
app.isQuitting = false;

const gotTheLock = app.requestSingleInstanceLock();

const getIconPath = () => {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'favicon.png')
        : path.join(__dirname, 'favicon.png');
};

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    function createWindow() {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            title: "Sable Client",
            icon: path.join(__dirname, 'favicon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        mainWindow.removeMenu();

        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.executeJavaScript('localStorage.setItem("notificationsEnabled", "true");');
        });

        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (!url.includes('sable.moe')) {
                shell.openExternal(url);
                return { action: 'deny' };
            }
            return { action: 'allow' };
        });

        mainWindow.webContents.on('will-navigate', (event, url) => {
            if (!url.includes('sable.moe')) {
                event.preventDefault();
                shell.openExternal(url);
            }
        });

        session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
            return (permission === 'media' || permission === 'notifications' || permission === 'display-capture');
        });

        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            const url = webContents.getURL();
            const isSable = url.includes('sable.moe');
            const isAllowedPermission = (permission === 'media' || permission === 'notifications' || permission === 'display-capture');
            callback(isSable && isAllowedPermission);
        });

        // TODO: window picker
        session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
            desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
                if (sources && sources.length > 0) {
                    callback({ video: sources[0], audio: 'loopback' });
                }
            }).catch(err => {
                console.error('Error getting desktop sources:', err);
            });
        });

        mainWindow.loadURL('https://app.sable.moe');

        mainWindow.on('close', (event) => {
            if (!app.isQuitting) {
                event.preventDefault();
                mainWindow.hide();
            }
            return false;
        });
    }

    function createTray() {
        const iconPath = getIconPath();

        try {
            tray = new Tray(iconPath);

            const contextMenu = Menu.buildFromTemplate([
                {
                    label: 'Open Sable Client', click: () => {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit', click: () => {
                        app.isQuitting = true;
                        app.quit();
                    }
                }
            ]);

            tray.setToolTip('Sable Client');
            tray.setContextMenu(contextMenu);

            tray.on('click', () => {
                mainWindow.show();
                mainWindow.focus();
            });
        } catch (error) {
            console.error("FAILED to create tray:", error);
        }
    }

    ipcMain.on('notify', (event, { title, body }) => {
        const toast = new Notification({
            title: title,
            body: body,
            icon: getIconPath,
            silent: false
        });

        toast.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });

        toast.show();
    });

    app.whenReady().then(() => {
        createWindow();
        createTray();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}