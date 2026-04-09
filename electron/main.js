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

// ── MCP Setup (writes to claude_desktop_config.json directly) ──

function getClaudeConfigPath() {
  const appData = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'Claude', 'claude_desktop_config.json');
}

ipcMain.handle('check-mcp-status', () => {
  try {
    const configPath = getClaudeConfigPath();
    console.log('MCP check path:', configPath);
    if (!fs.existsSync(configPath)) {
      console.log('MCP config not found');
      return { registered: false, configPath };
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    const registered = !!(config.mcpServers && config.mcpServers.devproduct);
    console.log('MCP registered:', registered);
    return { registered, configPath };
  } catch (e) {
    console.log('MCP check error:', e.message);
    return { registered: false, error: e.message };
  }
});

function getMcpServerPath() {
  if (app.isPackaged) {
    // Production: mcp-server.js is in resources/ next to app.asar
    return path.join(process.resourcesPath, 'mcp-server.js');
  }
  // Dev: mcp-server.js is in the project root
  return path.resolve(path.join(__dirname, '..', 'mcp-server.js'));
}

ipcMain.handle('setup-mcp', () => {
  try {
    const configPath = getClaudeConfigPath();
    const configDir = path.dirname(configPath);
    const serverPath = getMcpServerPath();

    console.log('MCP setup - config:', configPath);
    console.log('MCP setup - server:', serverPath);

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Load existing config or start fresh
    let config = {};
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(raw);
    }

    // Add devproduct server
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers.devproduct = {
      command: 'node',
      args: [serverPath],
    };

    // Write it back
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Verify it was written
    const verify = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const success = !!(verify.mcpServers && verify.mcpServers.devproduct);
    console.log('MCP setup verified:', success);

    return { success };
  } catch (e) {
    console.log('MCP setup error:', e.message);
    return { success: false, error: e.message };
  }
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

// ── Local HTTP API for MCP Server ──

const http = require('http');
const API_PORT = 17532;

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const apiServer = http.createServer(async (req, res) => {
  // CORS for local only
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // POST /navigate — switch tabs
    if (req.method === 'POST' && req.url === '/navigate') {
      const { tab } = await parseBody(req);
      mainWindow.webContents.send('external-navigate', tab);
      mainWindow.focus();
      return sendJson(res, 200, { success: true });
    }

    // POST /set-place — load a place by ID
    if (req.method === 'POST' && req.url === '/set-place') {
      const { placeId } = await parseBody(req);
      const result = await robloxApi.getUniverseId(placeId);
      if (result.success) {
        mainWindow.webContents.send('external-set-place', {
          placeId,
          universeId: result.universeId,
          gameName: result.gameName,
        });
        mainWindow.focus();
      }
      return sendJson(res, 200, result);
    }

    // POST /queue — add products to the creation queue visually
    if (req.method === 'POST' && req.url === '/queue') {
      const { products } = await parseBody(req);
      mainWindow.webContents.send('external-navigate', 'create');
      mainWindow.webContents.send('external-queue', products);
      mainWindow.focus();
      return sendJson(res, 200, { success: true, queued: products.length });
    }

    // POST /create — trigger creation of queued products and wait for results
    if (req.method === 'POST' && req.url === '/create') {
      const { universeId, products } = await parseBody(req);
      mainWindow.webContents.send('external-navigate', 'create');
      mainWindow.webContents.send('external-queue', products);
      mainWindow.focus();

      // Small delay so the UI shows the queue before starting
      await new Promise((r) => setTimeout(r, 500));

      // Trigger bulk creation and collect results
      const result = await robloxApi.bulkCreate(universeId, products, (progress) => {
        mainWindow.webContents.send('bulk-progress', progress);
        mainWindow.webContents.send('external-progress', progress);
      });

      // Tell renderer creation is done
      mainWindow.webContents.send('external-create-done', result);
      return sendJson(res, 200, result);
    }

    // GET /products — list existing products
    if (req.method === 'GET' && req.url.startsWith('/products')) {
      const url = new URL(req.url, 'http://localhost');
      const universeId = url.searchParams.get('universeId');
      const pageToken = url.searchParams.get('pageToken');
      if (!universeId) return sendJson(res, 400, { error: 'universeId required' });

      mainWindow.webContents.send('external-navigate', 'manage');
      mainWindow.focus();

      const allProducts = [];
      let token = pageToken || null;
      do {
        const result = await robloxApi.listProducts(universeId, token);
        if (!result.success) return sendJson(res, 500, result);
        allProducts.push(...result.products);
        token = result.nextPageToken;
      } while (token);

      return sendJson(res, 200, { success: true, products: allProducts });
    }

    // POST /validate-cookie
    if (req.method === 'POST' && req.url === '/validate-cookie') {
      const { cookie } = await parseBody(req);
      const result = await robloxApi.validateCookie(cookie);
      if (result.success) {
        mainWindow.webContents.send('external-authenticated', result);
      }
      return sendJson(res, 200, result);
    }

    // POST /update-product
    if (req.method === 'POST' && req.url === '/update-product') {
      const { universeId, productId, fields } = await parseBody(req);
      const result = await robloxApi.updateProduct(universeId, productId, fields);
      return sendJson(res, 200, result);
    }

    // GET /status — check if app is running and authenticated
    if (req.method === 'GET' && req.url === '/status') {
      const autoLogin = await robloxApi.tryAutoLogin();
      return sendJson(res, 200, {
        running: true,
        authenticated: autoLogin.success,
        user: autoLogin.success ? autoLogin : null,
      });
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

apiServer.listen(API_PORT, '127.0.0.1', () => {
  console.log(`MCP API server listening on http://127.0.0.1:${API_PORT}`);
});
