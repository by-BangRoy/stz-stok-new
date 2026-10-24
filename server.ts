import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_PRODUCTS } from './src/data/initialData.ts';
import { Product, StockLog, RealtimeMessage, DeviceInfo, AppSettings } from './src/types/inventory.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DEFAULT_SETTINGS: AppSettings = {
  securityPin: '000000',
  pinRequired: true,
  autoLockMinutes: 30,
  soundEnabled: true,
  defaultMinStockAlert: 3,
  enableStockNotifications: true,
  profile: {
    storeName: '',
    storeBranch: '',
    tagline: '',
    phone: '',
    address: '',
    ownerName: '',
    socialMedia: '',
  },
};

// In-memory state
let products: Product[] = [];
let stockLogs: StockLog[] = [];
let appSettings: AppSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

// Load or initialize data
function loadData() {
  try {
    if (fs.existsSync(INVENTORY_FILE)) {
      const raw = fs.readFileSync(INVENTORY_FILE, 'utf-8');
      products = JSON.parse(raw);
    } else {
      products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
      saveInventory();
    }
  } catch (err) {
    console.error('Error loading inventory file, fallback to initial data:', err);
    products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
  }

  try {
    if (fs.existsSync(LOGS_FILE)) {
      const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
      stockLogs = JSON.parse(raw);
    } else {
      // Seed initial sample logs
      stockLogs = [
        {
          id: 'log-seed-1',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          productId: 'prod-1',
          productName: 'Gamis Silk Premium Zhafira',
          variantId: 'var-1-2',
          variantDescription: 'M / Sage Green',
          changeType: 'sale',
          delta: -1,
          previousStock: 13,
          newStock: 12,
          reason: 'Transaksi Kasir POS 1',
          deviceId: 'dev-pos-1',
          deviceName: 'Tablet Kasir Depan',
          operatorName: 'Siti (Kasir)',
        },
        {
          id: 'log-seed-2',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
          productId: 'prod-3',
          productName: 'Pashmina Ceruty Babydoll Armani',
          variantId: 'var-3-1',
          variantDescription: 'All Size / Jet Black',
          changeType: 'restock',
          delta: 15,
          previousStock: 10,
          newStock: 25,
          reason: 'Kiriman Konveksi Pusat Batch #82',
          deviceId: 'dev-wh-1',
          deviceName: 'HP Android Gudang',
          operatorName: 'Rian (Gudang)',
        },
      ];
      saveLogs();
    }
  } catch (err) {
    console.error('Error loading logs file:', err);
    stockLogs = [];
  }

  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      // If previous default PIN was 1234, update to 000000 as requested
      if (loaded.securityPin === '1234') {
        loaded.securityPin = '000000';
      }
      appSettings = {
        ...DEFAULT_SETTINGS,
        ...loaded,
        profile: {
          ...DEFAULT_SETTINGS.profile,
          ...(loaded.profile || {}),
        },
      };
      // If profile had the demo values, empty them as requested
      if (appSettings.profile.storeName === 'STZ Fashion Boutique') {
        appSettings.profile = {
          storeName: '',
          storeBranch: '',
          tagline: '',
          phone: '',
          address: '',
          ownerName: '',
          socialMedia: '',
        };
      }
      saveSettings();
    } else {
      appSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      saveSettings();
    }
  } catch (err) {
    console.error('Error loading settings file:', err);
    appSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function saveInventory() {
  try {
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify(products, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save inventory:', err);
  }
}

function saveLogs() {
  try {
    // Keep last 500 logs
    if (stockLogs.length > 500) {
      stockLogs = stockLogs.slice(0, 500);
    }
    fs.writeFileSync(LOGS_FILE, JSON.stringify(stockLogs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save logs:', err);
  }
}

loadData();

const app = express();
app.use(express.json());

// Track connected devices
interface ConnectedClient {
  ws: WebSocket;
  deviceId: string;
  deviceName: string;
  operatorName: string;
  ip: string;
  connectedAt: string;
  userAgent?: string;
}

const connectedClients = new Map<WebSocket, ConnectedClient>();

// Helper to broadcast to all WebSocket clients
function broadcast(message: RealtimeMessage, excludeWs?: WebSocket) {
  const data = JSON.stringify(message);
  for (const [ws, client] of connectedClients.entries()) {
    if (excludeWs && ws === excludeWs) continue;
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
      } catch (err) {
        console.error('Error broadcasting to client:', client.deviceId, err);
      }
    }
  }
}

function broadcastPresence() {
  const devices: DeviceInfo[] = Array.from(connectedClients.values()).map(c => ({
    deviceId: c.deviceId,
    deviceName: c.deviceName,
    operatorName: c.operatorName,
    ip: c.ip,
    lastSeen: new Date().toISOString(),
    userAgent: c.userAgent,
  }));

  broadcast({
    type: 'DEVICE_PRESENCE',
    payload: {
      count: connectedClients.size,
      devices,
    },
  });
}

// REST API Endpoints
app.get('/api/inventory', (req, res) => {
  const totalUnits = products.reduce((acc, p) => acc + p.totalStock, 0);
  res.json({
    products,
    totalProducts: products.length,
    totalUnits,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/logs', (req, res) => {
  const limit = Number(req.query.limit) || 100;
  res.json({
    logs: stockLogs.slice(0, limit),
    totalLogs: stockLogs.length,
  });
});

app.get('/api/devices', (req, res) => {
  const devices = Array.from(connectedClients.values()).map(c => ({
    deviceId: c.deviceId,
    deviceName: c.deviceName,
    operatorName: c.operatorName,
    ip: c.ip,
    connectedAt: c.connectedAt,
  }));
  res.json({
    count: connectedClients.size,
    devices,
  });
});

// Adjust stock of a variant
app.post('/api/stock/adjust', (req, res) => {
  const {
    productId,
    variantId,
    delta, // number: +x or -x
    changeType = 'adjustment',
    reason = '',
    deviceId = 'unknown-device',
    deviceName = 'Perangkat Tidak Dikenal',
    operatorName = 'Staf Toko',
  } = req.body;

  if (!productId || !variantId || typeof delta !== 'number') {
    return res.status(400).json({ error: 'Parameter productId, variantId, dan delta harus valid' });
  }

  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Produk tidak ditemukan' });
  }

  const variant = product.variants.find(v => v.id === variantId);
  if (!variant) {
    return res.status(404).json({ error: 'Varian tidak ditemukan' });
  }

  const previousStock = variant.stock;
  const newStock = Math.max(0, previousStock + delta);
  variant.stock = newStock;

  // Recalculate total product stock
  product.totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  product.updatedAt = new Date().toISOString();
  product.lastUpdatedBy = {
    deviceId,
    deviceName,
    operatorName,
  };

  // Create stock log
  const newLog: StockLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    productId: product.id,
    productName: product.name,
    variantId: variant.id,
    variantDescription: `${variant.size} / ${variant.color}`,
    changeType,
    delta,
    previousStock,
    newStock,
    reason,
    deviceId,
    deviceName,
    operatorName,
  };

  stockLogs.unshift(newLog);
  saveInventory();
  saveLogs();

  const realtimePayload: RealtimeMessage = {
    type: 'STOCK_UPDATED',
    payload: {
      product,
      log: newLog,
      isLowStock: newStock <= variant.minStock,
      isOutOfStock: newStock === 0,
    },
    meta: {
      deviceId,
      deviceName,
      operatorName,
      timestamp: new Date().toISOString(),
    },
  };

  broadcast(realtimePayload);

  return res.json({
    success: true,
    product,
    log: newLog,
  });
});

// Batch adjust (e.g. Stock Opname or Multi-item Checkout)
app.post('/api/stock/batch', (req, res) => {
  const { items, deviceId = 'web', deviceName = 'Perangkat Web', operatorName = 'Staf' } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array diperlukan' });
  }

  const affectedProducts: Product[] = [];
  const createdLogs: StockLog[] = [];

  for (const item of items) {
    const { productId, variantId, delta, changeType = 'adjustment', reason = '' } = item;
    const product = products.find(p => p.id === productId);
    if (!product) continue;
    const variant = product.variants.find(v => v.id === variantId);
    if (!variant) continue;

    const previousStock = variant.stock;
    const newStock = Math.max(0, previousStock + (typeof delta === 'number' ? delta : 0));
    variant.stock = newStock;
    product.totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    product.updatedAt = new Date().toISOString();
    product.lastUpdatedBy = { deviceId, deviceName, operatorName };

    const log: StockLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantDescription: `${variant.size} / ${variant.color}`,
      changeType,
      delta,
      previousStock,
      newStock,
      reason,
      deviceId,
      deviceName,
      operatorName,
    };

    createdLogs.unshift(log);
    if (!affectedProducts.some(p => p.id === product.id)) {
      affectedProducts.push(product);
    }
  }

  stockLogs.unshift(...createdLogs);
  saveInventory();
  saveLogs();

  broadcast({
    type: 'BATCH_RESTOCK',
    payload: {
      products: affectedProducts,
      logs: createdLogs,
    },
    meta: {
      deviceId,
      deviceName,
      operatorName,
      timestamp: new Date().toISOString(),
    },
  });

  return res.json({
    success: true,
    affectedCount: affectedProducts.length,
    logs: createdLogs,
  });
});

// Create product
app.post('/api/products', (req, res) => {
  const body = req.body;
  const { deviceId = 'web', deviceName = 'Web App', operatorName = 'Admin' } = body;

  const id = `prod-${Date.now()}`;
  const totalStock = (body.variants || []).reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);

  const newProduct: Product = {
    id,
    sku: body.sku || `STZ-${Date.now().toString().slice(-4)}`,
    name: body.name || 'Produk Busana Baru',
    category: body.category || 'Lainnya',
    description: body.description || '',
    imageUrl: body.imageUrl || 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    location: body.location || 'Rak Display',
    variants: (body.variants || []).map((v: any, index: number) => ({
      id: v.id || `var-${id}-${index + 1}`,
      sku: v.sku || `${body.sku || 'STZ'}-${index + 1}`,
      size: v.size || 'All Size',
      color: v.color || 'Standar',
      colorHex: v.colorHex || '#CBD5E1',
      stock: Number(v.stock) || 0,
      minStock: Number(v.minStock) || 3,
      price: Number(v.price) || 100000,
      costPrice: Number(v.costPrice) || 60000,
      barcode: v.barcode || `${Date.now()}${index}`,
    })),
    totalStock,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: { deviceId, deviceName, operatorName },
  };

  products.unshift(newProduct);
  saveInventory();

  // Log creation
  const log: StockLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    productId: newProduct.id,
    productName: newProduct.name,
    variantId: 'all',
    variantDescription: `${newProduct.variants.length} varian`,
    changeType: 'restock',
    delta: totalStock,
    previousStock: 0,
    newStock: totalStock,
    reason: 'Penambahan Produk Baru ke Katalog',
    deviceId,
    deviceName,
    operatorName,
  };
  stockLogs.unshift(log);
  saveLogs();

  broadcast({
    type: 'PRODUCT_CREATED',
    payload: {
      product: newProduct,
      log,
    },
    meta: { deviceId, deviceName, operatorName, timestamp: new Date().toISOString() },
  });

  return res.status(201).json({ success: true, product: newProduct });
});

// Update product
app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const { deviceId = 'web', deviceName = 'Web App', operatorName = 'Admin' } = body;

  const productIndex = products.findIndex(p => p.id === id);
  if (productIndex === -1) {
    return res.status(404).json({ error: 'Produk tidak ditemukan' });
  }

  const existingProduct = products[productIndex];
  const updatedVariants = body.variants ? body.variants.map((v: any, index: number) => ({
    id: v.id || `var-${id}-${index + 1}`,
    sku: v.sku || `${body.sku || existingProduct.sku}-${index + 1}`,
    size: v.size || 'All Size',
    color: v.color || 'Standar',
    colorHex: v.colorHex || '#CBD5E1',
    stock: Number(v.stock) || 0,
    minStock: Number(v.minStock) || 3,
    price: Number(v.price) || 100000,
    costPrice: Number(v.costPrice) || 60000,
    barcode: v.barcode || `${Date.now()}${index}`,
  })) : existingProduct.variants;

  const totalStock = updatedVariants.reduce((sum: number, v: any) => sum + v.stock, 0);

  const updatedProduct: Product = {
    ...existingProduct,
    sku: body.sku || existingProduct.sku,
    name: body.name || existingProduct.name,
    category: body.category || existingProduct.category,
    description: body.description !== undefined ? body.description : existingProduct.description,
    imageUrl: body.imageUrl || existingProduct.imageUrl,
    location: body.location || existingProduct.location,
    variants: updatedVariants,
    totalStock,
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: { deviceId, deviceName, operatorName },
  };

  products[productIndex] = updatedProduct;
  saveInventory();

  broadcast({
    type: 'PRODUCT_UPDATED',
    payload: { product: updatedProduct },
    meta: { deviceId, deviceName, operatorName, timestamp: new Date().toISOString() },
  });

  return res.json({ success: true, product: updatedProduct });
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { deviceId = 'web', deviceName = 'Web App', operatorName = 'Admin' } = req.query as any;

  const productIndex = products.findIndex(p => p.id === id);
  if (productIndex === -1) {
    return res.status(404).json({ error: 'Produk tidak ditemukan' });
  }

  const removed = products.splice(productIndex, 1)[0];
  saveInventory();

  broadcast({
    type: 'PRODUCT_DELETED',
    payload: { productId: id, productName: removed.name },
    meta: { deviceId, deviceName, operatorName, timestamp: new Date().toISOString() },
  });

  return res.json({ success: true, removedId: id });
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
  res.json({ success: true, settings: appSettings });
});

app.post('/api/settings', (req, res) => {
  const { settings, deviceId = 'web', deviceName = 'Web App', operatorName = 'Admin' } = req.body;
  if (!settings) {
    return res.status(400).json({ error: 'Data settings diperlukan' });
  }

  appSettings = {
    ...appSettings,
    ...settings,
    profile: {
      ...appSettings.profile,
      ...(settings.profile || {}),
    },
  };
  saveSettings();

  broadcast({
    type: 'SETTINGS_UPDATED',
    payload: { settings: appSettings },
    meta: { deviceId, deviceName, operatorName, timestamp: new Date().toISOString() },
  });

  return res.json({ success: true, settings: appSettings });
});

app.post('/api/settings/reset', (req, res) => {
  const { deviceId = 'web', deviceName = 'Web App', operatorName = 'Admin' } = req.body;
  appSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  saveSettings();

  broadcast({
    type: 'SETTINGS_UPDATED',
    payload: { settings: appSettings },
    meta: { deviceId, deviceName, operatorName, timestamp: new Date().toISOString() },
  });

  return res.json({ success: true, settings: appSettings, message: 'Pengaturan berhasil direset ke bawaan pabrik' });
});

// Kosongkan semua stok (Zero out all inventory)
app.post('/api/stock/clear-all', (req, res) => {
  const { deviceId = 'web', deviceName = 'Web App', operatorName = 'Admin', pin } = req.body;

  // Verify PIN if required
  if (appSettings.pinRequired && pin !== appSettings.securityPin) {
    return res.status(401).json({ error: 'PIN Keamanan salah! Tidak dapat mengosongkan stok.' });
  }

  const totalPreviousUnits = products.reduce((acc, p) => acc + p.totalStock, 0);

  // Set all variants of all products to 0
  for (const product of products) {
    for (const variant of product.variants) {
      variant.stock = 0;
    }
    product.totalStock = 0;
    product.updatedAt = new Date().toISOString();
    product.lastUpdatedBy = { deviceId, deviceName, operatorName };
  }

  const log: StockLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    productId: 'all',
    productName: 'Semua Produk Busana',
    variantId: 'all',
    variantDescription: 'Seluruh Katalog',
    changeType: 'adjustment',
    delta: -totalPreviousUnits,
    previousStock: totalPreviousUnits,
    newStock: 0,
    reason: 'Pengosongan Semua Stok Fisik Toko Menjadi 0 Pcs',
    deviceId,
    deviceName,
    operatorName,
  };

  stockLogs.unshift(log);
  saveInventory();
  saveLogs();

  broadcast({
    type: 'ALL_STOCK_CLEARED',
    payload: { products, log },
    meta: { deviceId, deviceName, operatorName, timestamp: new Date().toISOString() },
  });

  return res.json({
    success: true,
    totalCleared: totalPreviousUnits,
    products,
    log,
  });
});

// Hapus Semua Produk dari Katalog
app.post('/api/products/clear-all', (req, res) => {
  const { deviceId = 'web', deviceName = 'Web App', operatorName = 'Admin', pin } = req.body;

  // Verify PIN
  if (appSettings.pinRequired && pin !== appSettings.securityPin) {
    return res.status(401).json({ error: 'PIN Keamanan salah! Tidak dapat menghapus semua produk.' });
  }

  const previousCount = products.length;
  const totalUnits = products.reduce((acc, p) => acc + p.totalStock, 0);

  // Clear products
  products = [];
  saveInventory();

  const log: StockLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    productId: 'all',
    productName: 'Semua Produk Busana',
    variantId: 'all',
    variantDescription: `${previousCount} model busana dihapus`,
    changeType: 'adjustment',
    delta: -totalUnits,
    previousStock: totalUnits,
    newStock: 0,
    reason: 'Penghapusan Total: Hapus Seluruh Produk Busana dari Katalog',
    deviceId,
    deviceName,
    operatorName,
  };

  stockLogs.unshift(log);
  saveLogs();

  broadcast({
    type: 'ALL_PRODUCTS_DELETED',
    payload: { products: [], log },
    meta: { deviceId, deviceName, operatorName, timestamp: new Date().toISOString() },
  });

  return res.json({
    success: true,
    clearedCount: previousCount,
    log,
  });
});

// Hapus Aktivitas Hari Ini (Clear logs created today)
app.post('/api/logs/clear-today', (req, res) => {
  const { deviceId = 'web', deviceName = 'Web App', operatorName = 'Admin', pin } = req.body;

  // Verify PIN if required
  if (appSettings.pinRequired && pin !== appSettings.securityPin) {
    return res.status(401).json({ error: 'PIN Keamanan salah! Tidak dapat menghapus aktivitas hari ini.' });
  }

  // Determine today date in local/ISO format YYYY-MM-DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayDateStr = `${year}-${month}-${day}`;

  const beforeCount = stockLogs.length;

  stockLogs = stockLogs.filter(log => {
    try {
      const d = new Date(log.timestamp);
      const lYear = d.getFullYear();
      const lMonth = String(d.getMonth() + 1).padStart(2, '0');
      const lDay = String(d.getDate()).padStart(2, '0');
      const logDateStr = `${lYear}-${lMonth}-${lDay}`;
      return logDateStr !== todayDateStr;
    } catch {
      return true;
    }
  });

  const deletedCount = beforeCount - stockLogs.length;
  saveLogs();

  broadcast({
    type: 'TODAY_LOGS_CLEARED',
    payload: { logs: stockLogs, deletedCount },
    meta: { deviceId, deviceName, operatorName, timestamp: new Date().toISOString() },
  });

  return res.json({
    success: true,
    deletedCount,
    remainingCount: stockLogs.length,
    message: `${deletedCount} aktivitas stok hari ini berhasil dihapus`,
  });
});

// Verify PIN endpoint
app.post('/api/auth/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (!appSettings.pinRequired) {
    return res.json({ success: true, message: 'PIN tidak diwajibkan' });
  }
  const isValid = pin === appSettings.securityPin;
  return res.json({ success: isValid });
});

// Reset demo data
app.post('/api/reset-demo', (req, res) => {
  products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
  saveInventory();
  stockLogs = [];
  saveLogs();

  broadcast({
    type: 'INIT',
    payload: {
      products,
      logs: stockLogs,
      settings: appSettings,
    },
  });

  return res.json({ success: true, message: 'Data demo telah direset' });
});

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  const ip = req.socket.remoteAddress || '127.0.0.1';
  const defaultClient: ConnectedClient = {
    ws,
    deviceId: `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    deviceName: 'Perangkat Browser',
    operatorName: 'Staf',
    ip,
    connectedAt: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || 'Unknown Device',
  };

  connectedClients.set(ws, defaultClient);

  // Send initial full inventory, logs, and settings to newly connected client
  const initMsg: RealtimeMessage = {
    type: 'INIT',
    payload: {
      products,
      logs: stockLogs.slice(0, 50),
      settings: appSettings,
      clientInfo: {
        assignedDeviceId: defaultClient.deviceId,
        serverTime: new Date().toISOString(),
        totalUnits: products.reduce((acc, p) => acc + p.totalStock, 0),
      },
    },
  };
  ws.send(JSON.stringify(initMsg));

  // Announce presence
  broadcastPresence();

  // Handle incoming messages from client
  ws.on('message', (data: string) => {
    try {
      const msg: RealtimeMessage = JSON.parse(data.toString());

      if (msg.type === 'DEVICE_PRESENCE' && msg.meta) {
        // Client updating its identity (e.g. user set deviceName to "Tablet Kasir 1")
        const current = connectedClients.get(ws);
        if (current) {
          current.deviceId = msg.meta.deviceId || current.deviceId;
          current.deviceName = msg.meta.deviceName || current.deviceName;
          current.operatorName = msg.meta.operatorName || current.operatorName;
          connectedClients.set(ws, current);
          broadcastPresence();
        }
      } else if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (err) {
      console.error('Error parsing client WS message:', err);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    broadcastPresence();
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
    connectedClients.delete(ws);
    broadcastPresence();
  });
});

// Configure Vite integration for dev mode or static files for production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`STZ Fashion Stok Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
