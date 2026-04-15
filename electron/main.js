const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const robloxApi = require('./roblox-api');

// Preserve the userData folder from before the rename so existing users keep
// their encrypted cookie and saved places. Must run before app.whenReady().
// Electron defaults userData to `<appData>/<productName>`; we pin it to the
// legacy name. Leaves the appId and updater channel untouched.
app.setPath('userData', path.join(app.getPath('appData'), 'DevProduct Bulk Creator'));

let mainWindow;

// ── Auto Updater ──

autoUpdater.autoDownload = false;

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', status);
  }
}

autoUpdater.on('update-available', (info) => {
  sendUpdateStatus({ type: 'available', version: info.version });
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus({ type: 'progress', percent: Math.round(progress.percent) });
});

autoUpdater.on('update-downloaded', () => {
  sendUpdateStatus({ type: 'ready' });
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
    title: 'Roblox Product Manager',
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
  try {
    fs.writeFileSync(getSavedPlacesPath(), JSON.stringify(places, null, 2));
  } catch (e) {
    console.log('Failed to persist saved places:', e.message);
  }
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

// Claude Desktop can be installed two ways on Windows:
//   1. MSIX / Microsoft Store — sandboxed to
//      %LOCALAPPDATA%\Packages\Claude_<publisherHash>\LocalCache\Roaming\Claude\
//   2. Traditional installer — %APPDATA%\Claude\
// We prefer whichever one actually has a Claude folder present. If both exist
// (rare), MSIX wins because that's what Claude Desktop actually reads from when
// installed via the Store.
function getClaudeConfigCandidates() {
  const home = require('os').homedir();
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

  const candidates = [];

  // MSIX installs — scan %LOCALAPPDATA%\Packages for any Claude_* folder so
  // we don't hard-code a single publisher hash.
  const packagesDir = path.join(local, 'Packages');
  if (fs.existsSync(packagesDir)) {
    try {
      for (const entry of fs.readdirSync(packagesDir)) {
        if (/^(Claude|AnthropicPBC\.Claude)_/i.test(entry)) {
          candidates.push({
            kind: 'msix',
            package: entry,
            configPath: path.join(
              packagesDir,
              entry,
              'LocalCache',
              'Roaming',
              'Claude',
              'claude_desktop_config.json'
            ),
          });
        }
      }
    } catch (e) {
      // Directory not readable — ignore and fall through.
    }
  }

  // Traditional installer
  candidates.push({
    kind: 'traditional',
    configPath: path.join(appData, 'Claude', 'claude_desktop_config.json'),
  });

  return candidates;
}

function getClaudeConfigPath() {
  const candidates = getClaudeConfigCandidates();

  // Prefer a candidate whose Claude folder already exists (Claude Desktop
  // creates this on first launch, so existence is a reliable "this install is
  // what the user is actually running" signal).
  for (const c of candidates) {
    if (fs.existsSync(path.dirname(c.configPath))) {
      return c.configPath;
    }
  }

  // No Claude folder exists anywhere — fall back to the traditional path and
  // let the setup handler create it. Worst case: the user installed from the
  // Store but hasn't launched Claude Desktop yet; re-running setup after
  // launching Claude Desktop once will pick up the correct MSIX path.
  return candidates[candidates.length - 1].configPath;
}

function getMcpServerPath() {
  if (app.isPackaged) {
    // Production: mcp-server.js is in resources/ next to app.asar
    return path.join(process.resourcesPath, 'mcp-server.js');
  }
  // Dev: mcp-server.js is in the project root
  return path.resolve(path.join(__dirname, '..', 'mcp-server.js'));
}

function buildMcpEntry() {
  // Use Electron's bundled node runtime so users don't need Node.js installed.
  // When ELECTRON_RUN_AS_NODE=1, the Electron binary behaves exactly like node.
  // In dev mode, process.execPath is electron.exe from node_modules — still works.
  return {
    command: process.execPath,
    args: [getMcpServerPath()],
    env: {
      ELECTRON_RUN_AS_NODE: '1',
      // Let mcp-server.js auto-launch the correct app binary even if installed
      // to a non-default location.
      DEVPRODUCT_APP_PATH: process.execPath,
    },
  };
}

function isEntryHealthy(entry, expectedPath) {
  if (!entry || typeof entry !== 'object') return { ok: false, issue: 'Missing MCP entry.' };

  const serverPath = entry.args && entry.args[0];
  if (!serverPath) return { ok: false, issue: 'MCP config is missing the server path.' };
  if (!fs.existsSync(serverPath)) {
    return { ok: false, issue: 'MCP server file is missing. The app may have been moved or reinstalled.' };
  }

  const normalize = (p) => path.resolve(p).toLowerCase();
  if (normalize(serverPath) !== normalize(expectedPath)) {
    return { ok: false, issue: 'MCP points to an outdated install location.' };
  }

  // Detect legacy configs that rely on a system `node` binary. Users without
  // Node.js installed would hit a silent "failed to start" on Claude Desktop's
  // side — so treat this as unhealthy and prompt a reconnect.
  const cmd = String(entry.command || '').toLowerCase();
  if (cmd === 'node' || cmd === 'node.exe') {
    return { ok: false, issue: 'MCP uses the legacy "node" command. Reconnect to use the app\'s bundled runtime.' };
  }
  if (!fs.existsSync(entry.command)) {
    return { ok: false, issue: 'MCP command path no longer exists. Reconnect to refresh.' };
  }
  if (!entry.env || entry.env.ELECTRON_RUN_AS_NODE !== '1') {
    return { ok: false, issue: 'MCP is missing required environment. Reconnect to refresh.' };
  }
  if (normalize(entry.command) !== normalize(process.execPath)) {
    return { ok: false, issue: 'MCP points to an outdated app binary.' };
  }

  return { ok: true, issue: null };
}

ipcMain.handle('check-mcp-status', () => {
  const configPath = getClaudeConfigPath();
  const expectedPath = getMcpServerPath();
  try {
    if (!fs.existsSync(configPath)) {
      return {
        registered: false,
        healthy: false,
        configPath,
        expectedPath,
        issue: 'Claude Desktop config not found. Is Claude Desktop installed?',
      };
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    const entry = config.mcpServers && config.mcpServers.devproduct;

    if (!entry) {
      return {
        registered: false,
        healthy: false,
        configPath,
        expectedPath,
        issue: 'Roblox Product Manager MCP is not registered in Claude Desktop.',
      };
    }

    const { ok, issue } = isEntryHealthy(entry, expectedPath);
    return {
      registered: true,
      healthy: ok,
      configPath,
      serverPath: entry.args && entry.args[0],
      expectedPath,
      issue,
    };
  } catch (e) {
    console.log('MCP check error:', e.message);
    return {
      registered: false,
      healthy: false,
      configPath,
      expectedPath,
      issue: `Failed to read config: ${e.message}`,
    };
  }
});

// Remove the `devproduct` entry from any config that isn't the active one.
// Prevents stale entries in the traditional location from haunting users who
// are actually running the MSIX Claude Desktop (or vice versa).
function pruneStaleMcpConfigs(activeConfigPath) {
  const normalize = (p) => path.resolve(p).toLowerCase();
  const activeNormalized = normalize(activeConfigPath);

  for (const candidate of getClaudeConfigCandidates()) {
    if (normalize(candidate.configPath) === activeNormalized) continue;
    if (!fs.existsSync(candidate.configPath)) continue;

    try {
      const raw = fs.readFileSync(candidate.configPath, 'utf8');
      const config = JSON.parse(raw);
      if (config.mcpServers && config.mcpServers.devproduct) {
        delete config.mcpServers.devproduct;
        fs.writeFileSync(candidate.configPath, JSON.stringify(config, null, 2));
        console.log('Removed stale devproduct entry from:', candidate.configPath);
      }
    } catch (e) {
      // Non-fatal — leave it alone.
      console.log('Could not prune stale config at', candidate.configPath, '-', e.message);
    }
  }
}

ipcMain.handle('setup-mcp', () => {
  try {
    const configPath = getClaudeConfigPath();
    const configDir = path.dirname(configPath);

    console.log('MCP setup - config:', configPath);
    console.log('MCP setup - server:', getMcpServerPath());

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Load existing config or start fresh
    let config = {};
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      try {
        config = JSON.parse(raw);
      } catch (parseErr) {
        return { success: false, error: `Existing Claude config is not valid JSON: ${parseErr.message}` };
      }
    }

    // Add devproduct server (uses Electron's bundled node — no external Node.js required)
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers.devproduct = buildMcpEntry();

    // Write it back
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Clean up any stale devproduct entry in the other config location
    // (e.g. leftover from before we detected MSIX installs correctly).
    pruneStaleMcpConfigs(configPath);

    // Verify it was written
    const verify = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const success = !!(verify.mcpServers && verify.mcpServers.devproduct);
    console.log('MCP setup verified:', success);

    return { success, configPath };
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
    sendToWindow('bulk-progress', progress);
  });
});

ipcMain.handle('cancel-bulk', async () => {
  robloxApi.cancelBulk();
});

// ── Gamepass IPC ──

ipcMain.handle('list-gamepasses', async (_, universeId, pageToken) => {
  return robloxApi.listGamepasses(universeId, pageToken);
});

ipcMain.handle('create-gamepass', async (_, universeId, gamepass) => {
  return robloxApi.createGamepass(universeId, gamepass);
});

ipcMain.handle('update-gamepass', async (_, universeId, gamepassId, fields) => {
  return robloxApi.updateGamepass(universeId, gamepassId, fields);
});

ipcMain.handle('bulk-create-gamepasses', async (_, universeId, gamepasses) => {
  return robloxApi.bulkCreateGamepasses(universeId, gamepasses, (progress) => {
    sendToWindow('bulk-gamepass-progress', progress);
  });
});

ipcMain.handle('cancel-bulk-gamepasses', async () => {
  robloxApi.cancelBulkGamepasses();
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

// Safe send + focus that won't crash if the window isn't ready yet or was destroyed.
function sendToWindow(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
}

function focusWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
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
      sendToWindow('external-navigate', tab);
      focusWindow();
      return sendJson(res, 200, { success: true });
    }

    // POST /set-place — load a place by ID
    if (req.method === 'POST' && req.url === '/set-place') {
      const { placeId } = await parseBody(req);
      const result = await robloxApi.getUniverseId(placeId);
      if (result.success) {
        sendToWindow('external-set-place', {
          placeId,
          universeId: result.universeId,
          gameName: result.gameName,
        });
        focusWindow();
      }
      return sendJson(res, 200, result);
    }

    // POST /queue — add products to the creation queue visually
    if (req.method === 'POST' && req.url === '/queue') {
      const { products } = await parseBody(req);
      sendToWindow('external-navigate', 'products-create');
      sendToWindow('external-queue', products);
      focusWindow();
      return sendJson(res, 200, { success: true, queued: products.length });
    }

    // POST /create — trigger creation of queued products and wait for results
    if (req.method === 'POST' && req.url === '/create') {
      const { universeId, products } = await parseBody(req);
      sendToWindow('external-navigate', 'products-create');
      sendToWindow('external-queue', products);
      focusWindow();

      // Small delay so the UI shows the queue before starting
      await new Promise((r) => setTimeout(r, 500));

      // Trigger bulk creation and collect results
      const result = await robloxApi.bulkCreate(universeId, products, (progress) => {
        sendToWindow('bulk-progress', progress);
        sendToWindow('external-progress', progress);
      });

      // Tell renderer creation is done
      sendToWindow('external-create-done', result);
      return sendJson(res, 200, result);
    }

    // GET /products — list existing products
    if (req.method === 'GET' && req.url.startsWith('/products')) {
      const url = new URL(req.url, 'http://localhost');
      const universeId = url.searchParams.get('universeId');
      const pageToken = url.searchParams.get('pageToken');
      if (!universeId) return sendJson(res, 400, { error: 'universeId required' });

      sendToWindow('external-navigate', 'products-manage');
      focusWindow();

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
        sendToWindow('external-authenticated', result);
      }
      return sendJson(res, 200, result);
    }

    // POST /update-product
    if (req.method === 'POST' && req.url === '/update-product') {
      const { universeId, productId, fields } = await parseBody(req);
      const result = await robloxApi.updateProduct(universeId, productId, fields);
      return sendJson(res, 200, result);
    }

    // GET /gamepasses — list existing gamepasses
    if (req.method === 'GET' && req.url.startsWith('/gamepasses')) {
      const url = new URL(req.url, 'http://localhost');
      const universeId = url.searchParams.get('universeId');
      const pageToken = url.searchParams.get('pageToken');
      if (!universeId) return sendJson(res, 400, { error: 'universeId required' });

      sendToWindow('external-navigate', 'gamepasses-manage');
      focusWindow();

      const allGamepasses = [];
      let token = pageToken || null;
      do {
        const result = await robloxApi.listGamepasses(universeId, token);
        if (!result.success) return sendJson(res, 500, result);
        allGamepasses.push(...result.gamepasses);
        token = result.nextPageToken;
      } while (token);

      return sendJson(res, 200, { success: true, gamepasses: allGamepasses });
    }

    // POST /queue-gamepasses — add gamepasses to the creation queue visually
    if (req.method === 'POST' && req.url === '/queue-gamepasses') {
      const { gamepasses } = await parseBody(req);
      sendToWindow('external-navigate', 'gamepasses-create');
      sendToWindow('external-gamepass-queue', gamepasses);
      focusWindow();
      return sendJson(res, 200, { success: true, queued: gamepasses.length });
    }

    // POST /create-gamepasses — queue and create gamepasses, wait for results
    if (req.method === 'POST' && req.url === '/create-gamepasses') {
      const { universeId, gamepasses } = await parseBody(req);
      sendToWindow('external-navigate', 'gamepasses-create');
      sendToWindow('external-gamepass-queue', gamepasses);
      focusWindow();

      await new Promise((r) => setTimeout(r, 500));

      const result = await robloxApi.bulkCreateGamepasses(universeId, gamepasses, (progress) => {
        sendToWindow('bulk-gamepass-progress', progress);
        sendToWindow('external-gamepass-progress', progress);
      });

      sendToWindow('external-gamepass-create-done', result);
      return sendJson(res, 200, result);
    }

    // POST /update-gamepass
    if (req.method === 'POST' && req.url === '/update-gamepass') {
      const { universeId, gamepassId, fields } = await parseBody(req);
      const result = await robloxApi.updateGamepass(universeId, gamepassId, fields);
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

apiServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`MCP API port ${API_PORT} is already in use — another instance may be running.`);
  } else {
    console.log('MCP API server error:', err.message);
  }
});

apiServer.listen(API_PORT, '127.0.0.1', () => {
  console.log(`MCP API server listening on http://127.0.0.1:${API_PORT}`);
});
