import { Router } from 'express';
import { db } from '../db/database.js';
import { NetworkService } from '../services/networkService.js';

const router = Router();

// Get Network info & Tablet QR code
router.get('/system/network-info', async (req, res) => {
  try {
    const frontendPort = Number(process.env.FRONTEND_PORT) || 5173;
    const backendPort = Number(process.env.PORT) || 4000;
    const info = await NetworkService.getNetworkAccessInfo(frontendPort, backendPort);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get System Settings
router.get('/system/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update System Settings
router.put('/system/settings', (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Configuraciones inválidas' });
    }

    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const updateTx = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        upsertStmt.run(key, String(value));
      }
    });

    updateTx();

    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
