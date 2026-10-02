import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

router.get('/reports/sales', (req, res) => {
  try {
    const { period = 'day' } = req.query; 
    // period can be 'day', 'week', 'month', 'year'
    
    let periodExpr = "strftime('%Y-%m-%d', closed_at, 'localtime')";
    let labelExpr = "strftime('%d/%m/%Y', closed_at, 'localtime')";
    
    if (period === 'month') {
      periodExpr = "strftime('%Y-%m', closed_at, 'localtime')";
      labelExpr = "strftime('%m/%Y', closed_at, 'localtime')";
    } else if (period === 'year') {
      periodExpr = "strftime('%Y', closed_at, 'localtime')";
      labelExpr = "strftime('%Y', closed_at, 'localtime')";
    } else if (period === 'week') {
      // Monday of the week
      periodExpr = "date(closed_at, 'localtime', 'weekday 0', '-6 days')";
      // Formatted as: DD/MM/YY - DD/MM/YY
      labelExpr = "strftime('%d/%m/', date(closed_at, 'localtime', 'weekday 0', '-6 days')) || substr(strftime('%Y', date(closed_at, 'localtime', 'weekday 0', '-6 days')), 3, 2) || ' - ' || strftime('%d/%m/', date(closed_at, 'localtime', 'weekday 0')) || substr(strftime('%Y', date(closed_at, 'localtime', 'weekday 0')), 3, 2)";
    }
    
    const query = `
      SELECT 
        ${periodExpr} as period,
        ${labelExpr} as period_label,
        COUNT(id) as total_orders,
        COALESCE(SUM(total), 0) as total_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0) as transfer_sales,
        COALESCE(SUM(CASE WHEN payment_method IN ('delivery', 'app') THEN total ELSE 0 END), 0) as delivery_sales
      FROM orders
      WHERE status = 'paid'
      GROUP BY period
      ORDER BY period DESC
      LIMIT 100
    `;
    
    const data = db.prepare(query).all();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
