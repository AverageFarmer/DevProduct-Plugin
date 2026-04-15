#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const APP_URL = 'http://127.0.0.1:17532';
const PROJECT_DIR = path.resolve(__dirname);
let appProcess = null;

// ── Auto-launch the Electron app if not running ──

function isAppRunning() {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: 17532, path: '/status', method: 'GET', timeout: 1000 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(true));
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function findInstalledExe() {
  const isDevProductExe = (p) =>
    p && /devproduct bulk creator\.exe$/i.test(p) && fs.existsSync(p);

  // 1. Honor the exact path the app wrote into the config env (most reliable),
  //    but only if it actually points at the product binary (not dev electron.exe).
  const fromEnv = process.env.DEVPRODUCT_APP_PATH;
  if (isDevProductExe(fromEnv)) return fromEnv;

  // 2. Try common NSIS install locations as a fallback.
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'DevProduct Bulk Creator', 'DevProduct Bulk Creator.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'DevProduct Bulk Creator', 'DevProduct Bulk Creator.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'DevProduct Bulk Creator', 'DevProduct Bulk Creator.exe'),
  ];
  for (const candidate of candidates) {
    if (isDevProductExe(candidate)) return candidate;
  }
  return null;
}

async function ensureAppRunning() {
  if (await isAppRunning()) return;

  const installedExe = findInstalledExe();

  if (installedExe) {
    appProcess = spawn(installedExe, [], {
      detached: true,
      stdio: 'ignore',
    });
  } else if (fs.existsSync(path.join(PROJECT_DIR, 'package.json'))) {
    // Dev fallback — only useful when running from a cloned repo
    appProcess = spawn('cmd.exe', ['/c', 'npx', 'electron', '.'], {
      cwd: PROJECT_DIR,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
  } else {
    throw new Error(
      'DevProduct app is not running and its install location could not be found. ' +
      'Please open the DevProduct Bulk Creator app manually.'
    );
  }
  appProcess.unref();

  // Wait for the app to start (up to 15 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isAppRunning()) return;
  }
  throw new Error('DevProduct app failed to start within 15 seconds.');
}

// ── HTTP helper to talk to the Electron app ──

async function appRequest(method, urlPath, body) {
  await ensureAppRunning();

  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, APP_URL);
    const data = body ? JSON.stringify(body) : null;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({ error: raw });
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(
        `Cannot connect to DevProduct app. (${err.message})`
      ));
    });

    if (data) req.write(data);
    req.end();
  });
}

// ── MCP Server ──

const server = new Server(
  { name: 'devproduct', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'set-cookie',
      description:
        'Validate and set the .ROBLOSECURITY cookie in the DevProduct app. Call this first if the app is not already logged in.',
      inputSchema: {
        type: 'object',
        properties: {
          cookie: { type: 'string', description: 'The .ROBLOSECURITY cookie value' },
        },
        required: ['cookie'],
      },
    },
    {
      name: 'set-place',
      description:
        'Load a Roblox game by Place ID in the DevProduct app. The app will resolve the Universe ID and show the game name.',
      inputSchema: {
        type: 'object',
        properties: {
          placeId: { type: 'string', description: 'The Roblox Place ID' },
        },
        required: ['placeId'],
      },
    },
    {
      name: 'list-products',
      description:
        'List all existing developer products for a universe. Switches the app to the Manage tab. Returns all products with their IDs, names, and prices.',
      inputSchema: {
        type: 'object',
        properties: {
          universeId: { type: 'string', description: 'The Roblox Universe ID' },
        },
        required: ['universeId'],
      },
    },
    {
      name: 'create-products',
      description:
        'Create developer products in bulk. Adds them to the queue visually in the app, then creates them. Returns the product IDs. Use this to create new developer products for a game.',
      inputSchema: {
        type: 'object',
        properties: {
          universeId: { type: 'string', description: 'The Roblox Universe ID' },
          products: {
            type: 'array',
            description: 'Array of products to create',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Product name' },
                price: { type: 'number', description: 'Price in Robux' },
                description: { type: 'string', description: 'Optional description' },
              },
              required: ['name', 'price'],
            },
          },
        },
        required: ['universeId', 'products'],
      },
    },
    {
      name: 'update-product',
      description: 'Update an existing developer product (name, price, or description).',
      inputSchema: {
        type: 'object',
        properties: {
          universeId: { type: 'string', description: 'The Roblox Universe ID' },
          productId: { type: 'string', description: 'The developer product ID to update' },
          name: { type: 'string', description: 'New name (optional)' },
          price: { type: 'number', description: 'New price in Robux (optional)' },
          description: { type: 'string', description: 'New description (optional)' },
        },
        required: ['universeId', 'productId'],
      },
    },
    {
      name: 'app-status',
      description:
        'Check if the DevProduct app is running and whether the user is logged in.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'app-status': {
        const result = await appRequest('GET', '/status');
        return {
          content: [
            {
              type: 'text',
              text: result.authenticated
                ? `App is running. Logged in as ${result.user.username} (${result.user.displayName}).`
                : 'App is running but not logged in. Use set-cookie to authenticate.',
            },
          ],
        };
      }

      case 'set-cookie': {
        const result = await appRequest('POST', '/validate-cookie', {
          cookie: args.cookie,
        });
        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Authenticated as ${result.displayName} (@${result.username}). User ID: ${result.userId}`,
              },
            ],
          };
        }
        return {
          content: [{ type: 'text', text: `Authentication failed: ${result.error}` }],
          isError: true,
        };
      }

      case 'set-place': {
        const result = await appRequest('POST', '/set-place', {
          placeId: args.placeId,
        });
        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Loaded game "${result.gameName}" (Universe ID: ${result.universeId}). The app is now showing this game.`,
              },
            ],
          };
        }
        return {
          content: [{ type: 'text', text: `Failed to load place: ${result.error}` }],
          isError: true,
        };
      }

      case 'list-products': {
        const result = await appRequest(
          'GET',
          `/products?universeId=${args.universeId}`
        );
        if (result.success) {
          if (result.products.length === 0) {
            return {
              content: [{ type: 'text', text: 'No developer products found for this game.' }],
            };
          }
          const table = result.products
            .map((p) => `["${p.name}"] = ${p.productId}, -- R$ ${p.price}`)
            .join('\n');
          return {
            content: [
              {
                type: 'text',
                text: `Found ${result.products.length} developer products:\n\n${table}`,
              },
            ],
          };
        }
        return {
          content: [{ type: 'text', text: `Failed to list products: ${result.error}` }],
          isError: true,
        };
      }

      case 'create-products': {
        // This visually adds to the queue and creates them
        const result = await appRequest('POST', '/create', {
          universeId: args.universeId,
          products: args.products,
        });

        if (result.success) {
          const succeeded = result.results.filter((r) => r.success);
          const failed = result.results.filter((r) => !r.success);

          let text = `Created ${succeeded.length} of ${result.results.length} products.\n\n`;

          if (succeeded.length > 0) {
            text += 'Lua table:\n```lua\nreturn {\n';
            text += succeeded
              .map((r) => `\t["${r.name}"] = ${r.product.productId || r.product.id},`)
              .join('\n');
            text += '\n}\n```\n';
          }

          if (failed.length > 0) {
            text += `\nFailed products:\n`;
            text += failed.map((r) => `- ${r.name}: ${r.error}`).join('\n');
          }

          return { content: [{ type: 'text', text }] };
        }
        return {
          content: [{ type: 'text', text: `Bulk create failed: ${result.error}` }],
          isError: true,
        };
      }

      case 'update-product': {
        const fields = {};
        if (args.name) fields.name = args.name;
        if (args.price) fields.price = args.price;
        if (args.description !== undefined) fields.description = args.description;

        const result = await appRequest('POST', '/update-product', {
          universeId: args.universeId,
          productId: args.productId,
          fields,
        });

        if (result.success) {
          return {
            content: [{ type: 'text', text: `Product ${args.productId} updated successfully.` }],
          };
        }
        return {
          content: [{ type: 'text', text: `Failed to update: ${result.error}` }],
          isError: true,
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: err.message }],
      isError: true,
    };
  }
});

// Prevent crashes from killing the MCP server
process.on('uncaughtException', (err) => {
  process.stderr.write(`MCP uncaught error: ${err.message}\n`);
});
process.on('unhandledRejection', (err) => {
  process.stderr.write(`MCP unhandled rejection: ${err}\n`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`MCP fatal: ${err.message}\n`);
  process.exit(1);
});
