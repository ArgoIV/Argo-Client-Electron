const { app, BrowserWindow, session, Notification, ipcMain, Tray, Menu } = require('electron'); // Added Tray and Menu
const path = require('path');

let mainWindow;
let tray = null;
app.isQuitting = false;

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

    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'media') return true;
        return false;
    });

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        const url = webContents.getURL();
        if (permission === 'media' && url.includes('sable.moe')) {
            callback(true);
        } else {
            callback(false);
        }
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
    tray = new Tray(path.join(__dirname, 'favicon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Sable Client', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: 'Quit', click: () => {
            app.isQuitting = true;
            app.quit();
        }}
    ]);

    tray.setToolTip('Sable Client');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => mainWindow.show());
}


ipcMain.on('notify', (event, { title, body }) => {
    const toast = new Notification({ 
        title: title, 
        body: body,
        icon: path.join(__dirname, 'favicon.png')
    });

    toast.show();

    toast.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

app.whenReady().then(() => {
    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});