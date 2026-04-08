const https = require('https');
const http = require('http');
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

let storedCookie = null;
let csrfToken = null;
let bulkCancelled = false;

// ── Cookie Persistence (encrypted on disk) ──

function getCookiePath() {
  return path.join(app.getPath('userData'), '.session');
}

function saveCookie(cookie) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(cookie);
      fs.writeFileSync(getCookiePath(), encrypted);
    }
  } catch (e) {
    // Silently fail — cookie just won't persist
  }
}

function loadCookie() {
  try {
    const cookiePath = getCookiePath();
    if (fs.existsSync(cookiePath) && safeStorage.isEncryptionAvailable()) {
      const encrypted = fs.readFileSync(cookiePath);
      return safeStorage.decryptString(encrypted);
    }
  } catch (e) {
    // Silently fail
  }
  return null;
}

function clearCookie() {
  try {
    const cookiePath = getCookiePath();
    if (fs.existsSync(cookiePath)) {
      fs.unlinkSync(cookiePath);
    }
  } catch (e) {
    // Silently fail
  }
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const headers = { ...options.headers };
    if (storedCookie) {
      headers['Cookie'] = `.ROBLOSECURITY=${storedCookie}`;
    }
    if (csrfToken && ['POST', 'PATCH', 'DELETE'].includes(options.method)) {
      headers['x-csrf-token'] = csrfToken;
    }

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers,
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        // Capture CSRF token from any response
        const newToken = res.headers['x-csrf-token'];
        if (newToken) {
          csrfToken = newToken;
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
          json() {
            try { return JSON.parse(data); }
            catch { return null; }
          },
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      if (Buffer.isBuffer(options.body)) {
        req.write(options.body);
      } else {
        req.write(options.body);
      }
    }
    req.end();
  });
}

// Retry with CSRF token on 403
async function apiRequest(url, options = {}) {
  let res = await request(url, options);

  if (res.status === 403 && res.headers['x-csrf-token']) {
    csrfToken = res.headers['x-csrf-token'];
    res = await request(url, options);
  }

  return res;
}

function buildMultipartBody(fields, filePath) {
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`)
    );
  }

  // Attach image file if provided
  if (filePath && fs.existsSync(filePath)) {
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="imageFile"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`
      )
    );
    parts.push(fileData);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function validateCookie(cookie) {
  storedCookie = cookie;
  csrfToken = null;

  try {
    const res = await apiRequest('https://users.roblox.com/v1/users/authenticated', {
      method: 'GET',
    });

    if (res.status === 200) {
      const data = res.json();
      saveCookie(cookie);
      return { success: true, username: data.name, userId: data.id, displayName: data.displayName };
    }

    storedCookie = null;
    return { success: false, error: 'Invalid cookie. Status: ' + res.status };
  } catch (err) {
    storedCookie = null;
    return { success: false, error: err.message };
  }
}

async function tryAutoLogin() {
  const cookie = loadCookie();
  if (!cookie) return { success: false };
  return validateCookie(cookie);
}

function logout() {
  storedCookie = null;
  csrfToken = null;
  clearCookie();
}

async function getUniverseId(placeId) {
  try {
    // Use the apis.roblox.com endpoint for place-to-universe lookup
    const res = await apiRequest(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
    );

    if (res.status === 200) {
      const data = res.json();
      if (data && data.universeId) {
        // Fetch game name too
        const gameRes = await apiRequest(
          `https://games.roblox.com/v1/games?universeIds=${data.universeId}`
        );
        let gameName = '';
        if (gameRes.status === 200) {
          const gameData = gameRes.json();
          if (gameData && gameData.data && gameData.data[0]) {
            gameName = gameData.data[0].name;
          }
        }
        return { success: true, universeId: data.universeId, gameName };
      }
    }

    return { success: false, error: 'Could not find universe for Place ID ' + placeId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function listProducts(universeId, pageToken) {
  try {
    let url = `https://apis.roblox.com/developer-products/v2/universes/${universeId}/developer-products/creator?pageSize=50`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const res = await apiRequest(url, { method: 'GET' });

    if (res.status === 200) {
      const data = res.json();
      // Normalize API fields to consistent names
      const products = (data.developerProducts || []).map((p) => ({
        productId: p.productId || p.id,
        name: p.name,
        price: p.price ?? p.defaultPrice ?? p.priceInRobux ?? null,
        description: p.description || '',
        iconImageAssetId: p.iconImageAssetId || null,
        _raw: p, // keep raw data for debugging
      }));
      return {
        success: true,
        products,
        nextPageToken: data.nextPageToken || null,
      };
    }

    return { success: false, error: 'Failed to list products. Status: ' + res.status };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function createProduct(universeId, product) {
  try {
    const fields = {
      name: product.name,
      price: product.price,
    };
    if (product.description) {
      fields.description = product.description;
    }

    const { body, contentType } = buildMultipartBody(fields, product.imagePath);

    const res = await apiRequest(
      `https://apis.roblox.com/developer-products/v2/universes/${universeId}/developer-products`,
      {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      }
    );

    if (res.status === 200) {
      return { success: true, product: res.json() };
    }

    const errorData = res.json();
    return {
      success: false,
      error: (errorData && errorData.message) || 'Failed to create. Status: ' + res.status,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function updateProduct(universeId, productId, fields) {
  try {
    const { body, contentType } = buildMultipartBody(fields);

    const res = await apiRequest(
      `https://apis.roblox.com/developer-products/v2/universes/${universeId}/developer-products/${productId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': contentType },
        body,
      }
    );

    if (res.status === 204 || res.status === 200) {
      return { success: true };
    }

    const errorData = res.json();
    return {
      success: false,
      error: (errorData && errorData.message) || 'Failed to update. Status: ' + res.status,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bulkCreate(universeId, products, onProgress) {
  bulkCancelled = false;
  const results = [];

  for (let i = 0; i < products.length; i++) {
    if (bulkCancelled) {
      onProgress({
        current: i,
        total: products.length,
        status: 'cancelled',
        results,
      });
      return { success: true, results, cancelled: true };
    }

    const product = products[i];
    const result = await createProduct(universeId, product);
    results.push({ ...product, ...result });

    onProgress({
      current: i + 1,
      total: products.length,
      status: result.success ? 'success' : 'error',
      lastProduct: product.name,
      lastError: result.error || null,
      results,
    });

    // Rate limit: 3 req/sec → 350ms between requests
    if (i < products.length - 1) {
      await sleep(350);
    }
  }

  return { success: true, results, cancelled: false };
}

function cancelBulk() {
  bulkCancelled = true;
}

module.exports = {
  validateCookie,
  tryAutoLogin,
  logout,
  getUniverseId,
  listProducts,
  createProduct,
  updateProduct,
  bulkCreate,
  cancelBulk,
};
