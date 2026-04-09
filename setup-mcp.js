const fs = require('fs');
const path = require('path');

const projectDir = (process.argv[2] || __dirname).replace(/[\\/]+$/, '');
// Check both project root (dev) and resources dir (installed app)
let serverPath = path.join(projectDir, 'mcp-server.js');
if (!fs.existsSync(serverPath)) {
  serverPath = path.join(projectDir, 'resources', 'mcp-server.js');
}

// Claude Desktop config path
const configDir = path.join(process.env.APPDATA, 'Claude');
const configPath = path.join(configDir, 'claude_desktop_config.json');

console.log('MCP Server: ' + serverPath);
console.log('Config:     ' + configPath);
console.log('');

// Check mcp-server.js exists
if (!fs.existsSync(serverPath)) {
  console.log('ERROR: mcp-server.js not found at ' + serverPath);
  console.log('Make sure you run this from the DevProduct Plugin folder.');
  process.exit(1);
}

// Load or create config
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Found existing claude_desktop_config.json');
  } catch (e) {
    console.log('WARNING: Could not parse existing config, creating fresh one.');
    config = {};
  }
} else {
  console.log('Creating new claude_desktop_config.json');
  // Ensure the directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// Add/update the devproduct MCP server
if (!config.mcpServers) {
  config.mcpServers = {};
}

const alreadyExists = !!config.mcpServers.devproduct;

config.mcpServers.devproduct = {
  command: 'node',
  args: [serverPath],
};

// Write config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

if (alreadyExists) {
  console.log('Updated DevProduct MCP server config.');
} else {
  console.log('Added DevProduct MCP server to config.');
}

console.log('');
console.log('SUCCESS! Restart Claude Desktop for it to take effect.');
