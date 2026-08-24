const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = 3000;

const USERS = [
  { id: 'owner1', password: 'slushify123', role: 'owner', token: 'slushify-owner-token' },
  { id: 'shop1', password: 'shop123', role: 'shop', token: 'slushify-shop-token' }
];

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(filePath, defaultValue) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Could not read ${filePath}:`, error.message);
    return defaultValue;
  }
}

function saveJSON(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-Owner-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(fs.readFileSync(filePath));
}

function getUser(req) {
  const token = req.headers['x-auth-token'] || req.headers['x-owner-token'];
  return USERS.find(user => user.token === token) || null;
}

function requireRole(req, res, roles) {
  const user = getUser(req);
  if (user && roles.includes(user.role)) return user;
  sendJSON(res, 401, { error: 'Login required' });
  return null;
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function addNotification(type, message, item) {
  const notifications = loadJSON(NOTIFICATIONS_FILE, []);
  const notification = {
    id: Date.now().toString(),
    type,
    message,
    itemId: item && item.id,
    itemName: item && item.name,
    read: false,
    createdAt: new Date().toISOString()
  };
  notifications.unshift(notification);
  saveJSON(NOTIFICATIONS_FILE, notifications.slice(0, 100));
  return notification;
}

function normalizeItem(body, existing = {}) {
  return {
    ...existing,
    name: String(body.name || existing.name || '').trim(),
    category: String(body.category || existing.category || 'Menu').trim(),
    quantity: Number(body.quantity ?? existing.quantity ?? 0),
    price: Number(body.price ?? existing.price ?? 0),
    notes: String(body.notes || existing.notes || '').trim()
  };
}

async function handleAPI(req, res, url) {
  if (req.method === 'OPTIONS') {
    sendJSON(res, 200, {});
    return;
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const user = USERS.find(candidate => candidate.id === body.id && candidate.password === body.pass);
    if (!user) {
      sendJSON(res, 401, { error: 'Invalid credentials' });
      return;
    }
    sendJSON(res, 200, { success: true, role: user.role, token: user.token });
    return;
  }

  if (url.pathname === '/api/accounts' && req.method === 'GET') {
    if (!requireRole(req, res, ['owner'])) return;
    sendJSON(res, 200, loadJSON(ACCOUNTS_FILE, []));
    return;
  }

  if (url.pathname === '/api/accounts' && req.method === 'POST') {
    if (!requireRole(req, res, ['owner'])) return;
    const accounts = loadJSON(ACCOUNTS_FILE, []);
    const account = { ...(await readBody(req)), id: Date.now().toString(), createdAt: new Date().toISOString() };
    accounts.push(account);
    saveJSON(ACCOUNTS_FILE, accounts);
    sendJSON(res, 201, account);
    return;
  }

  if (url.pathname === '/api/inventory' && req.method === 'GET') {
    if (!requireRole(req, res, ['owner', 'shop'])) return;
    sendJSON(res, 200, loadJSON(INVENTORY_FILE, []));
    return;
  }

  if (url.pathname === '/api/inventory' && req.method === 'POST') {
    const user = requireRole(req, res, ['owner', 'shop']);
    if (!user) return;
    const inventory = loadJSON(INVENTORY_FILE, []);
    const item = {
      ...normalizeItem(await readBody(req)),
      id: Date.now().toString(),
      createdBy: user.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    inventory.push(item);
    saveJSON(INVENTORY_FILE, inventory);
    addNotification('item-added', `${item.name} was added to the menu at ${money(item.price)}.`, item);
    if (item.quantity <= 0) {
      addNotification('item-finished', `${item.name} is finished or out of stock.`, item);
    }
    sendJSON(res, 201, item);
    return;
  }

  const inventoryMatch = url.pathname.match(/^\/api\/inventory\/(.+)$/);
  if (inventoryMatch && req.method === 'PUT') {
    const user = requireRole(req, res, ['owner', 'shop']);
    if (!user) return;
    const inventory = loadJSON(INVENTORY_FILE, []);
    const index = inventory.findIndex(item => item.id === inventoryMatch[1]);
    if (index === -1) {
      sendJSON(res, 404, { error: 'Item not found' });
      return;
    }
    const previous = inventory[index];
    const updated = {
      ...normalizeItem(await readBody(req), previous),
      id: previous.id,
      createdBy: previous.createdBy,
      createdAt: previous.createdAt,
      updatedBy: user.role,
      updatedAt: new Date().toISOString()
    };
    inventory[index] = updated;
    saveJSON(INVENTORY_FILE, inventory);
    if ((Number(previous.quantity) || 0) > 0 && updated.quantity <= 0) {
      addNotification('item-finished', `${updated.name} is finished or out of stock.`, updated);
    }
    sendJSON(res, 200, updated);
    return;
  }

  if (inventoryMatch && req.method === 'DELETE') {
    if (!requireRole(req, res, ['owner'])) return;
    const inventory = loadJSON(INVENTORY_FILE, []);
    saveJSON(INVENTORY_FILE, inventory.filter(item => item.id !== inventoryMatch[1]));
    sendJSON(res, 200, { success: true });
    return;
  }

  if (url.pathname === '/api/notifications' && req.method === 'GET') {
    if (!requireRole(req, res, ['owner'])) return;
    sendJSON(res, 200, loadJSON(NOTIFICATIONS_FILE, []));
    return;
  }

  if (url.pathname === '/api/notifications/read' && req.method === 'PATCH') {
    if (!requireRole(req, res, ['owner'])) return;
    const notifications = loadJSON(NOTIFICATIONS_FILE, []).map(notification => ({ ...notification, read: true }));
    saveJSON(NOTIFICATIONS_FILE, notifications);
    sendJSON(res, 200, { success: true });
    return;
  }

  if (url.pathname === '/api/status' && req.method === 'GET') {
    if (!requireRole(req, res, ['owner'])) return;
    const accounts = loadJSON(ACCOUNTS_FILE, []);
    const inventory = loadJSON(INVENTORY_FILE, []);
    const notifications = loadJSON(NOTIFICATIONS_FILE, []);
    const inventoryValue = inventory.reduce((total, item) => total + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0);
    const finishedItems = inventory.filter(item => (Number(item.quantity) || 0) <= 0).length;
    sendJSON(res, 200, {
      accountsCount: accounts.length,
      inventoryCount: inventory.length,
      inventoryValue,
      finishedItems,
      unreadNotifications: notifications.filter(notification => !notification.read).length,
      timestamp: new Date().toISOString()
    });
    return;
  }

  sendJSON(res, 404, { error: 'API route not found' });
}

function getContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    await handleAPI(req, res, url);
    return;
  }

  if (url.pathname === '/') {
    sendFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
    return;
  }

  const safePath = path.normalize(url.pathname).replace(/^([/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  sendFile(res, filePath, getContentType(filePath));
});

function start() {
  ensureDataDir();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`slushify accounting running at http://localhost:${PORT}`);
    console.log('Owner side: /owner.html using owner1 / slushify123');
    console.log('Shop side: /shop.html using shop1 / shop123');
  });
}

if (require.main === module) {
  start();
}

module.exports = { server, start };
