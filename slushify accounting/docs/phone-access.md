# slushify accounting - Owner Phone Access

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

The server will run at `http://localhost:3000`

### 3. Find Your PC's IP Address
On Windows:
- Open Command Prompt
- Type: `ipconfig`
- Look for "IPv4 Address" (e.g., 192.168.1.15)

### 4. Access from Phone
On your phone's browser, go to:
```
http://<your-pc-ip>:3000
```

Example: `http://192.168.1.15:3000`

### 5. Owner Login
When the page loads, click "Login as Owner" and enter:
- **Owner ID**: `owner1`
- **Password**: `slushify123`

*(You can change these in `src/index.js` - see OWNERS_FILE section)*

## Features

### Public View (No Login Required)
- Live account counts
- Inventory item list
- Real-time updates (auto-refresh every 5 seconds)

### Owner Features (After Login)
- ✅ Add new inventory items
- ✅ Edit inventory quantities/prices
- ✅ Delete inventory items
- ✅ Full inventory management

## Phone/Desktop Setup Tips

### For Best Phone Experience:
- Use Chrome or Safari on your phone
- Rotate to landscape mode for wider view
- Bookmark the page for quick access

### To Customize:
- **Change owner credentials**: Edit `src/index.js`, find `ownersData` array
- **Change port**: Modify `const PORT = 3000;` in `src/index.js`
- **Add more owners**: Add entries to the `ownersData` array

### Data Persistence:
- Accounts saved to `data/accounts.json`
- Inventory saved to `data/inventory.json`
- Owner data saved to `data/owners.json`

## Troubleshooting

### "Cannot connect to server"
- Ensure the PC is on the same network as the phone
- Check firewall allows port 3000
- Verify IP address is correct

### Blank page or errors
- Run `npm install` to ensure all dependencies are installed
- Check that `npm start` is running without errors

### Owner login fails
- Verify the credentials match what's in `src/index.js`
- Make sure the server is running (`npm start`)