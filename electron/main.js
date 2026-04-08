const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const robloxApi = require('./roblox-api');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: 'DevProduct Bulk Creator',
    icon: path.join(__dirname, '..', 'icon.ico'),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

// ── IPC Handlers ──

ipcMain.handle('validate-cookie', async (_, cookie) => {
  return robloxApi.validateCookie(cookie);
});

ipcMain.handle('try-auto-login', async () => {
  return robloxApi.tryAutoLogin();
});

ipcMain.handle('logout', async () => {
  robloxApi.logout();
});

ipcMain.handle('get-universe-id', async (_, placeId) => {
  return robloxApi.getUniverseId(placeId);
});

ipcMain.handle('list-products', async (_, universeId, pageToken) => {
  return robloxApi.listProducts(universeId, pageToken);
});

ipcMain.handle('create-product', async (_, universeId, product) => {
  return robloxApi.createProduct(universeId, product);
});

ipcMain.handle('update-product', async (_, universeId, productId, fields) => {
  return robloxApi.updateProduct(universeId, productId, fields);
});

ipcMain.handle('bulk-create', async (event, universeId, products) => {
  return robloxApi.bulkCreate(universeId, products, (progress) => {
    mainWindow.webContents.send('bulk-progress', progress);
  });
});

ipcMain.handle('cancel-bulk', async () => {
  robloxApi.cancelBulk();
});
