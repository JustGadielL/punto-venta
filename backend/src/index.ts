import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/database.js';
import { initSocketIO } from './socket/socketHandler.js';
import { NetworkService } from './services/networkService.js';

// Route imports
import productsRoutes from './routes/products.routes.js';
import tablesRoutes from './routes/tables.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import cashRoutes from './routes/cash.routes.js';
import printerRoutes from './routes/printer.routes.js';
import systemRoutes from './routes/system.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import discountsRoutes from './routes/discounts.routes.js';
import modifiersRoutes from './routes/modifiers.routes.js';

dotenv.config();

// Ensure all Date instances and timezone calculations use Mexican Central Time (America/Mexico_City)
process.env.TZ = process.env.TIMEZONE || 'America/Mexico_City';

// Prevent server crash from unhandled promise rejections (e.g. from printer timeouts)
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0'; // Bind to all interfaces for LAN access

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize DB and Sockets
initDatabase();
initSocketIO(server);

// API Routes
app.use('/api', productsRoutes);
app.use('/api', tablesRoutes);
app.use('/api', ordersRoutes);
app.use('/api', cashRoutes);
app.use('/api', printerRoutes);
app.use('/api', systemRoutes);
app.use('/api', reportsRoutes);
app.use('/api', discountsRoutes);
app.use('/api', modifiersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Start Server
server.listen(PORT, HOST, async () => {
  const localIp = NetworkService.getPrimaryLocalIP();
  const frontendPort = Number(process.env.FRONTEND_PORT) || 5173;

  console.log('\n========================================================');
  console.log('🍽️  SISTEMA POS PARA RESTAURANTE (SERVIDOR LOCAL INICIADO)');
  console.log('========================================================');
  console.log(`📡 Backend API:      http://${localIp}:${PORT}/api`);
  console.log(`💻 Localhost API:    http://localhost:${PORT}/api`);
  console.log(`📱 Acceso Tablets:   http://${localIp}:${frontendPort}`);
  console.log(`💾 Base de Datos:    SQLite (WAL Mode) Activada`);
  console.log(`🖨️  Módulo Térmico:   Simulación & ESC/POS Listo`);
  console.log('========================================================\n');
});
