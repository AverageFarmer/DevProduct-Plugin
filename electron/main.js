const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const robloxApi = require('./roblox-api');

let mainWindow;

// ── Auto Updater ──

autoUpdater.autoDownload = false;

autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update-status', { type: 'available', version: info.version });
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow.webContents.send('update-status', { type: 'progress', percent: Math.round(progress.percent) });
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-status', { type: 'ready' });
});

autoUpdater.on('update-not-available', () => {
  // Up to date — no notification needed
});

autoUpdater.on('error', (err) => {
  console.log('Auto-update error:', err.message);
});

ipcMain.handle('download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

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

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  // Check for updates after a short delay
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
});

app.on('window-all-closed', () => {
  app.quit();
});

// ── Saved Places ──

const fs = require('fs');

function getSavedPlacesPath() {
  return path.join(app.getPath('userData'), 'saved-places.json');
}

function loadSavedPlaces() {
  try {
    const p = getSavedPlacesPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function writeSavedPlaces(places) {
  fs.writeFileSync(getSavedPlacesPath(), JSON.stringify(places, null, 2));
}

ipcMain.handle('get-saved-places', () => {
  return loadSavedPlaces();
});

ipcMain.handle('save-place', (_, place) => {
  const places = loadSavedPlaces();
  // Don't duplicate — update if same placeId exists
  const idx = places.findIndex((p) => p.placeId === place.placeId);
  if (idx >= 0) {
    places[idx] = place;
  } else {
    places.unshift(place);
  }
  writeSavedPlaces(places);
  return places;
});

ipcMain.handle('remove-saved-place', (_, placeId) => {
  let places = loadSavedPlaces();
  places = places.filter((p) => p.placeId !== placeId);
  writeSavedPlaces(places);
  return places;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// ── IPC Handlers ──

ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Product Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

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
