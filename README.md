# Roblox Product Manager

A desktop app for creating and managing Roblox Developer Products and Gamepasses in bulk. Built with Electron + React.

## Features

- **Bulk Creation** — Create dozens of dev products at once using manual entry, CSV import, or a template generator
- **Product Management** — View, edit, and search existing developer products
- **Extract Table** — Export all product IDs as a Lua table ready to paste into your game
- **Image Uploads** — Attach icons to products individually or set a default for the batch
- **Saved Places** — Quickly switch between your games
- **Auto Updates** — Get notified when a new version is available

## Download

Grab the latest installer from [Releases](https://github.com/AverageFarmer/DevProduct-Plugin/releases/latest).

## Setup

1. Download and install the `.exe` from Releases
2. Open the app and paste your `.ROBLOSECURITY` cookie to log in
3. Enter a Place ID to load your game
4. Start creating products

Your login is encrypted and saved locally so you stay logged in between sessions.

---

## Claude Code MCP Integration

This app includes an MCP server that lets [Claude Code](https://claude.ai/claude-code) create developer products for you automatically. Claude can read your game's shop code, create the products, and plug the IDs back in.

### MCP Setup

Click **"Setup Claude MCP"** in the sidebar. Done.

The button writes a config entry that uses the Electron binary already bundled
with this app as the Node runtime, so **you don't need Node.js installed**.
Restart Claude Desktop after setup for it to take effect.

If the status shows "MCP needs reconnection" (for example after updating the
app or moving the install folder), click **Reconnect MCP** in the sidebar to
refresh the config to the new install location.

### MCP Requirements

- [Claude Desktop](https://claude.ai/download) or [Claude Code](https://claude.ai/claude-code) installed
- Roblox Product Manager (auto-launches when Claude calls a tool; you can also open it first)
- You must be logged in to the app

### MCP Tools

| Tool | Description |
|------|-------------|
| `app-status` | Check if the app is running and authenticated |
| `set-cookie` | Log in to the app |
| `set-place` | Load a game by Place ID |
| `list-products` | List all existing developer products |
| `create-products` | Create developer products in bulk (visible in the app UI) |
| `update-product` | Update an existing developer product |
| `list-gamepasses` | List all existing gamepasses |
| `create-gamepasses` | Create gamepasses in bulk (visible in the app UI) |
| `update-gamepass` | Update an existing gamepass (name/price/description/isForSale) |

### Example Usage

Tell Claude Code something like:

> "Look at the shop in my game and create the developer products for it"

Claude will:
1. Read your game code via Roblox Studio
2. Open Roblox Product Manager and load your game
3. Create the products (you'll see them appear in the app)
4. Return the product IDs as a Lua table
5. Update your game code with the IDs

---

## Development

```bash
npm install
npm run dev       # webpack watch mode
npm run electron  # launch the app
npm run dist      # build the .exe
```
