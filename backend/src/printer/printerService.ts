import { db } from '../db/database.js';
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';

export interface TicketPrintResult {
  success: boolean;
  type: string;
  id: number;
  plainText: string;
  htmlContent: string;
  message: string;
}

export class PrinterService {
  private static getSettings(): Record<string, string> {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    return settings;
  }

  // Format a line with left and right text aligned to width (default 32 or 48 chars)
  private static formatLine(left: string, right: string, width: number = 42): string {
    const space = width - left.length - right.length;
    if (space <= 0) return `${left.substring(0, width - right.length - 1)} ${right}`;
    return left + ' '.repeat(space) + right;
  }

  private static formatCenter(text: string, width: number = 42): string {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
  }

  private static formatDivider(char: string = '-', width: number = 42): string {
    return char.repeat(width);
  }

  /**
   * Generates and prints (or mocks) a Customer Sale Ticket
   */
  public static printOrderReceipt(orderId: number): TicketPrintResult {
    const settings = this.getSettings();
    const order = db.prepare(`
      SELECT o.*, t.name as table_name, t.number as table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(orderId) as any;

    if (!order) {
      throw new Error(`Orden #${orderId} no encontrada`);
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
    for (const item of items) {
      item.modifiers = db.prepare('SELECT modifier_name FROM order_item_modifiers WHERE order_item_id = ?').all(item.id);
    }
    const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(orderId) as any[];

    const width = settings.paper_width === '58mm' ? 32 : 42;
    const currency = settings.currency || '$';
    const restName = settings.restaurant_name || 'MI RESTAURANTE';
    const address = settings.address || '';
    const phone = settings.phone || '';
    const rfc = settings.tax_id || '';
    const footer = settings.ticket_footer || '¡Gracias por su compra!';

    // 1. Plain Text Layout
    const lines: string[] = [];
    lines.push(this.formatCenter('*** ' + restName.toUpperCase() + ' ***', width));
    if (address) lines.push(this.formatCenter(address, width));
    if (phone) lines.push(this.formatCenter(`Tel: ${phone}`, width));
    if (rfc) lines.push(this.formatCenter(`RFC: ${rfc}`, width));
    lines.push(this.formatDivider('=', width));

    const dateStr = new Date(order.created_at.replace(' ', 'T') + 'Z').toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    lines.push(this.formatLine(`TICKET #${order.order_number}`, dateStr, width));
    const dest = order.type === 'dine_in' 
      ? (order.table_name ? (order.table_name.toLowerCase().startsWith('mesa') ? order.table_name.toUpperCase() : `MESA: ${order.table_name.toUpperCase()}`) : (order.table_number ? `MESA: ${order.table_number}` : 'MESA S/N'))
      : (order.type === 'take_out' ? 'PARA LLEVAR' : 'APP');
    lines.push(this.formatLine(`TIPO: ${dest}`, `ORDEN #${order.id}`, width));
    if (order.customer_name) lines.push(`CLIENTE: ${order.customer_name}`);
    lines.push(this.formatDivider('-', width));

    lines.push(this.formatLine('CANT PRODUCTO', 'TOTAL', width));
    lines.push(this.formatDivider('-', width));

    for (const item of items) {
      const itemTotal = (item.quantity * item.unit_price).toFixed(2);
      const nameLine = `${item.quantity}x ${item.product_name}`;
      lines.push(this.formatLine(nameLine, `${currency}${itemTotal}`, width));
      if (item.modifiers && item.modifiers.length > 0) {
        const countMap: Record<string, number> = {};
        item.modifiers.forEach((m: any) => {
          countMap[m.modifier_name] = (countMap[m.modifier_name] || 0) + 1;
        });
        const modStr = Object.entries(countMap).map(([name, count]) => `${count}x ${name}`).join(', ');
        lines.push(`   + ${modStr}`);
      }
      if (item.notes && item.notes.includes('[PARA LLEVAR]')) {
        lines.push('   * [PARA LLEVAR]');
      }
      const cleanNote = (item.notes || '').replace(/\[PARA LLEVAR\]/g, '').trim();
      if (cleanNote) {
        lines.push(`   * Nota: ${cleanNote}`);
      }
    }

    lines.push(this.formatDivider('-', width));
    lines.push(this.formatLine('SUBTOTAL:', `${currency}${order.subtotal.toFixed(2)}`, width));
    
    if (order.tax_amount > 0) {
      lines.push(this.formatLine(`IVA (${order.tax_rate}%):`, `${currency}${order.tax_amount.toFixed(2)}`, width));
    }
    if (order.discount_amount > 0) {
      lines.push(this.formatLine('DESCUENTO:', `-${currency}${order.discount_amount.toFixed(2)}`, width));
    }
    if (order.tip_amount > 0) {
      lines.push(this.formatLine('PROPINA:', `${currency}${order.tip_amount.toFixed(2)}`, width));
    }

    lines.push(this.formatDivider('=', width));
    lines.push(this.formatLine('TOTAL A PAGAR:', `${currency}${order.total.toFixed(2)}`, width));
    lines.push(this.formatDivider('=', width));

    // Payments
    if (payments.length > 0) {
      lines.push(this.formatCenter('DETALLE DE PAGO', width));
      for (const p of payments) {
        const methodMap: Record<string, string> = { cash: 'EFECTIVO', card: 'TARJETA', transfer: 'TRANSFERENCIA', app: 'APLICACIÓN' };
        const methodLabel = methodMap[p.method] || p.method.toUpperCase();
        lines.push(this.formatLine(`FORMA: ${methodLabel}`, `${currency}${p.amount.toFixed(2)}`, width));
        if (p.method === 'cash' && p.amount_tendered) {
          lines.push(this.formatLine('PAGO CON:', `${currency}${p.amount_tendered.toFixed(2)}`, width));
          lines.push(this.formatLine('CAMBIO:', `${currency}${p.change_amount.toFixed(2)}`, width));
        }
      }
      lines.push(this.formatDivider('-', width));
    }

    lines.push('');
    lines.push(this.formatCenter(footer, width));
    lines.push(this.formatCenter(`Ticket ID: ${order.id}-${order.order_number}`, width));
    lines.push('');

    const plainText = lines.join('\n');

    // 2. HTML Representation for modern visual preview in app
    const htmlContent = `
      <div class="ticket-receipt" style="font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 340px; margin: 0 auto; padding: 16px; background: #fff; color: #111; border: 1px dashed #ccc; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 4px; font-size: 13px; line-height: 1.4;">
        <div style="text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 4px;">${restName}</div>
        ${address ? `<div style="text-align: center; font-size: 11px; color: #555;">${address}</div>` : ''}
        ${phone ? `<div style="text-align: center; font-size: 11px; color: #555;">Tel: ${phone}</div>` : ''}
        ${rfc ? `<div style="text-align: center; font-size: 11px; color: #555;">RFC: ${rfc}</div>` : ''}
        <div style="border-top: 2px dashed #333; margin: 8px 0;"></div>
        
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>TICKET #${order.order_number}</span>
          <span>${dateStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 2px;">
          <span>${dest}</span>
          <span>Folio: ${order.id}</span>
        </div>
        ${order.customer_name ? `<div style="font-size: 12px; margin-top: 2px;">Cliente: <b>${order.customer_name}</b></div>` : ''}
        
        <div style="border-top: 1px dashed #888; margin: 8px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; text-transform: uppercase;">
          <span>Cant. / Producto</span>
          <span>Importe</span>
        </div>
        <div style="border-top: 1px dashed #888; margin: 4px 0 8px 0;"></div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${items.map(it => `
            <div>
              <div style="display: flex; justify-content: space-between;">
                <span><b>${it.quantity}x</b> ${it.product_name}</span>
                <span>${currency}${(it.quantity * it.unit_price).toFixed(2)}</span>
              </div>
              ${it.modifiers && it.modifiers.length > 0 ? `
                <div style="font-size: 11px; color: #555; padding-left: 12px;">
                  ↳ ${(() => {
                    const countMap: Record<string, number> = {};
                    it.modifiers.forEach((m: any) => { countMap[m.modifier_name] = (countMap[m.modifier_name] || 0) + 1; });
                    return Object.entries(countMap).map(([name, count]) => `${count}x ${name}`).join(', ');
                  })()}
                </div>
              ` : ''}
              ${it.notes && it.notes.includes('[PARA LLEVAR]') ? `
                <div style="font-size: 11px; font-weight: bold; color: #ea580c; padding-left: 12px;">↳ [PARA LLEVAR]</div>
              ` : ''}
              ${(() => {
                const clean = (it.notes || '').replace(/\[PARA LLEVAR\]/g, '').trim();
                return clean ? `<div style="font-size: 11px; color: #d97706; padding-left: 12px;">↳ ${clean}</div>` : '';
              })()}
            </div>
          `).join('')}
        </div>

        <div style="border-top: 1px dashed #888; margin: 8px 0;"></div>
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal:</span>
          <span>${currency}${order.subtotal.toFixed(2)}</span>
        </div>
        ${order.tax_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span>IVA (${order.tax_rate}%):</span>
            <span>${currency}${order.tax_amount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${order.discount_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #dc2626;">
            <span>Descuento:</span>
            <span>-${currency}${order.discount_amount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${order.tip_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #16a34a;">
            <span>Propina:</span>
            <span>${currency}${order.tip_amount.toFixed(2)}</span>
          </div>
        ` : ''}

        <div style="border-top: 2px solid #222; margin: 8px 0 4px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800;">
          <span>TOTAL:</span>
          <span>${currency}${order.total.toFixed(2)}</span>
        </div>
        <div style="border-top: 2px solid #222; margin: 4px 0 8px 0;"></div>

        ${payments.length > 0 ? `
          <div style="font-size: 11px; margin-top: 4px;">
            ${payments.map(p => `
              <div style="display: flex; justify-content: space-between;">
                <span>Pago (${({ cash: 'EFECTIVO', card: 'TARJETA', transfer: 'TRANSFERENCIA', app: 'APLICACIÓN' } as Record<string, string>)[p.method] || String(p.method || '').toUpperCase()}):</span>
                <span>${currency}${p.amount.toFixed(2)}</span>
              </div>
              ${p.method === 'cash' && p.amount_tendered ? `
                <div style="display: flex; justify-content: space-between; color: #555;">
                  <span>Entregado:</span>
                  <span>${currency}${p.amount_tendered.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; color: #15803d;">
                  <span>Cambio:</span>
                  <span>${currency}${p.change_amount.toFixed(2)}</span>
                </div>
              ` : ''}
            `).join('')}
          </div>
        ` : ''}

        <div style="border-top: 1px dashed #ccc; margin: 12px 0 8px 0;"></div>
        <div style="text-align: center; font-size: 11px; color: #555; font-style: italic;">
          ${footer}
        </div>
        <div style="text-align: center; font-size: 9px; color: #888; margin-top: 6px;">
          POS-REST • Folio: ${order.id}
        </div>
      </div>
    `;

    // Save into history
    const saved = db.prepare(`
      INSERT INTO printed_tickets (type, reference_id, title, content_plain, content_html)
      VALUES (?, ?, ?, ?, ?)
    `).run('order_receipt', order.id, `Ticket Venta #${order.order_number}`, plainText, htmlContent);

    // If real printer configured in future, call physical hardware driver
    this.sendToPhysicalPrinter(plainText, settings);

    return {
      success: true,
      type: 'order_receipt',
      id: Number(saved.lastInsertRowid),
      plainText,
      htmlContent,
      message: 'Ticket de venta generado e impreso correctamente'
    };
  }

  /**
   * Generates a single comanda ticket (for Cocina or Barra)
   */
  private static buildSingleComanda(
    order: any,
    items: any[],
    area: 'COCINA' | 'BARRA',
    settings: Record<string, string>
  ): { plainText: string; htmlContent: string; title: string } {
    const width = settings.paper_width === '58mm' ? 32 : 42;
    const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const dest = order.type === 'dine_in' 
      ? (order.table_name ? (order.table_name.toLowerCase().startsWith('mesa') ? order.table_name.toUpperCase() : `MESA: ${order.table_name.toUpperCase()}`) : (order.table_number ? `MESA: ${order.table_number}` : 'MESA S/N'))
      : (order.type === 'take_out' ? '*** ORDEN PARA LLEVAR ***' : '*** ORDEN POR APLICACIÓN (DELIVERY) ***');

    const isKitchen = area === 'COCINA';
    const areaTitle = isKitchen ? 'COCINA' : 'BARRA';
    const itemColHeader = isKitchen ? 'PLATILLO / ESPECIFICACIÓN' : 'BEBIDA / ESPECIFICACIÓN';
    const headerBg = isKitchen ? '#0f172a' : '#312e81';
    const title = `Comanda ${isKitchen ? 'Cocina' : 'Barra'} #${order.order_number}`;

    const lines: string[] = [];
    lines.push(this.formatCenter('==============================', width));
    lines.push(this.formatCenter(`>>> COMANDA ${areaTitle} <<<`, width));
    lines.push(this.formatCenter('==============================', width));
    lines.push(this.formatLine(`ORDEN: #${order.order_number}`, `HORA: ${timeStr}`, width));
    lines.push(this.formatLine(`DESTINO: ${dest}`, `FOLIO: ${order.id}`, width));
    if (order.customer_name) lines.push(`CLIENTE: ${order.customer_name}`);
    lines.push(this.formatDivider('-', width));
    lines.push(this.formatLine('CANT', itemColHeader, width));
    lines.push(this.formatDivider('=', width));

    for (const item of items) {
      lines.push(`[ ] ${item.quantity}x ${item.product_name.toUpperCase()}`);
      if (item.modifiers && item.modifiers.length > 0) {
        const countMap: Record<string, number> = {};
        item.modifiers.forEach((m: any) => {
          countMap[m.modifier_name] = (countMap[m.modifier_name] || 0) + 1;
        });
        const modStr = Object.entries(countMap).map(([name, count]) => `${count}x ${name}`).join(', ');
        lines.push(`     + ${modStr.toUpperCase()}`);
      }
      if (item.notes && item.notes.includes('[PARA LLEVAR]')) {
        lines.push('     >>> *** [PARA LLEVAR] *** <<<');
      }
      const cleanNote = (item.notes || '').replace(/\[PARA LLEVAR\]/g, '').trim();
      if (cleanNote) {
        lines.push(`     >>> NOTA: ${cleanNote.toUpperCase()} <<<`);
      }
      lines.push('');
    }

    lines.push(this.formatDivider('=', width));
    if (order.notes) {
      lines.push(`NOTA GENERAL: ${order.notes}`);
      lines.push(this.formatDivider('-', width));
    }
    lines.push(this.formatCenter(`--- FIN DE COMANDA ${areaTitle} ---`, width));
    lines.push('');

    const plainText = lines.join('\n');

    const htmlContent = `
      <div class="ticket-comanda" style="font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 340px; margin: 0 auto; padding: 16px; background: #fff; color: #000; border: 2px dashed #000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 4px; font-size: 13px; line-height: 1.4; page-break-after: always; break-after: page;">
        <div style="background: ${headerBg}; color: #fff; text-align: center; font-weight: bold; font-size: 15px; padding: 6px 4px; border-radius: 3px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          ${areaTitle}
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px;">
          <span>ORDEN #${order.order_number}</span>
          <span>${timeStr}</span>
        </div>
        <div style="border: 2px solid #000; padding: 6px; margin: 6px 0; border-radius: 4px; font-weight: bold; font-size: 14px; text-align: center; text-transform: uppercase;">
          ${dest}
        </div>
        ${order.customer_name ? `<div style="font-size: 12px; margin-bottom: 4px;">Cliente: <b>${order.customer_name}</b></div>` : ''}
        
        <div style="border-top: 2px dashed #000; margin: 8px 0;"></div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${items.map(it => `
            <div style="border-bottom: 1px dotted #ccc; padding-bottom: 6px;">
              <div style="font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <span style="background: #000; color: #fff; padding: 1px 6px; border-radius: 3px; margin-right: 4px;">${it.quantity}x</span>
                  ${it.product_name}
                </div>
                ${it.notes && it.notes.includes('[PARA LLEVAR]') ? `
                  <span style="background: #ea580c; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 900; letter-spacing: 0.5px;">PARA LLEVAR</span>
                ` : ''}
              </div>
              ${it.modifiers && it.modifiers.length > 0 ? `
                <div style="padding: 2px 6px; margin-top: 3px; font-size: 13px; border-left: 2px solid #000;">
                  + ${(() => {
                    const countMap: Record<string, number> = {};
                    it.modifiers.forEach((m: any) => { countMap[m.modifier_name] = (countMap[m.modifier_name] || 0) + 1; });
                    return Object.entries(countMap).map(([name, count]) => `${count}x ${name}`).join(', ');
                  })()}
                </div>
              ` : ''}
              ${(() => {
                const clean = (it.notes || '').replace(/\[PARA LLEVAR\]/g, '').trim();
                return clean ? `
                  <div style="border-left: 3px solid #000; padding: 3px 6px; margin-top: 3px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                    NOTA: ${clean}
                  </div>
                ` : '';
              })()}
            </div>
          `).join('')}
        </div>

        ${order.notes ? `
          <div style="margin-top: 8px; border: 2px solid #000; padding: 6px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
            <b>Nota general:</b> ${order.notes}
          </div>
        ` : ''}

        <div style="border-top: 2px dashed #000; margin: 10px 0 4px 0;"></div>
        <div style="text-align: center; font-size: 11px; font-weight: bold;">
          --- IMPRESO PARA ${areaTitle} ---
        </div>
      </div>
    `;

    return { plainText, htmlContent, title };
  }

  /**
   * Generates Kitchen Ticket (Comanda) - Separates Cocina and Barra if applicable
   */
  public static printKitchenComanda(orderId: number): TicketPrintResult {
    const settings = this.getSettings();
    const order = db.prepare(`
      SELECT o.*, t.name as table_name, t.number as table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(orderId) as any;

    if (!order) throw new Error(`Orden #${orderId} no encontrada`);

    // Fetch items that go to kitchen/bar
    const items = db.prepare(`
      SELECT oi.*, COALESCE(p.is_kitchen, 1) as is_kitchen
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(orderId) as any[];
    
    for (const item of items) {
      item.modifiers = db.prepare('SELECT modifier_name FROM order_item_modifiers WHERE order_item_id = ?').all(item.id);
    }

    const kitchenItems = items.filter(it => it.is_kitchen !== 0);
    const barItems = items.filter(it => it.is_kitchen === 0);

    // Fallback if all items had no category or 0
    const effectiveKitchenItems = kitchenItems.length === 0 && barItems.length === 0 ? items : kitchenItems;

    let kitchenTicket: { plainText: string; htmlContent: string; title: string } | null = null;
    let barTicket: { plainText: string; htmlContent: string; title: string } | null = null;
    let primaryTicketId = 0;

    // 1. Process Kitchen Ticket if items exist
    if (effectiveKitchenItems.length > 0) {
      kitchenTicket = this.buildSingleComanda(order, effectiveKitchenItems, 'COCINA', settings);
      const savedKitchen = db.prepare(`
        INSERT INTO printed_tickets (type, reference_id, title, content_plain, content_html)
        VALUES (?, ?, ?, ?, ?)
      `).run('kitchen_comanda', order.id, kitchenTicket.title, kitchenTicket.plainText, kitchenTicket.htmlContent);
      primaryTicketId = Number(savedKitchen.lastInsertRowid);
      this.sendToPhysicalPrinter(kitchenTicket.plainText, settings);
    }

    // 2. Process Bar Ticket if items exist
    if (barItems.length > 0) {
      barTicket = this.buildSingleComanda(order, barItems, 'BARRA', settings);
      const savedBar = db.prepare(`
        INSERT INTO printed_tickets (type, reference_id, title, content_plain, content_html)
        VALUES (?, ?, ?, ?, ?)
      `).run('bar_comanda', order.id, barTicket.title, barTicket.plainText, barTicket.htmlContent);
      if (!primaryTicketId) primaryTicketId = Number(savedBar.lastInsertRowid);
      this.sendToPhysicalPrinter(barTicket.plainText, settings);
    }

    // Mark items as printed in kitchen
    db.prepare("UPDATE order_items SET is_printed_kitchen = 1, status = 'cooking' WHERE order_id = ?").run(orderId);
    db.prepare("UPDATE orders SET status = 'in_preparation' WHERE id = ? AND status = 'pending'").run(orderId);

    // If both Cocina and Barra exist in this order
    if (kitchenTicket && barTicket) {
      const combinedPlainText = `${kitchenTicket.plainText}\n\n========================================\n========================================\n\n${barTicket.plainText}`;
      const combinedHtml = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
          ${kitchenTicket.htmlContent}
          <div style="border-top: 2px dashed #94a3b8; margin: 4px 0; text-align: center; color: #94a3b8; font-size: 11px; font-weight: bold; letter-spacing: 1px;">
            --- CORTE DE TICKET (BARRA / BEBIDAS) ---
          </div>
          ${barTicket.htmlContent}
        </div>
      `;
      return {
        success: true,
        type: 'kitchen_comanda',
        id: primaryTicketId,
        plainText: combinedPlainText,
        htmlContent: combinedHtml,
        message: 'Comandas de Cocina y Barra enviadas e impresas por separado'
      };
    } else if (kitchenTicket) {
      return {
        success: true,
        type: 'kitchen_comanda',
        id: primaryTicketId,
        plainText: kitchenTicket.plainText,
        htmlContent: kitchenTicket.htmlContent,
        message: 'Comanda de Cocina enviada e impresa'
      };
    } else if (barTicket) {
      return {
        success: true,
        type: 'bar_comanda',
        id: primaryTicketId,
        plainText: barTicket.plainText,
        htmlContent: barTicket.htmlContent,
        message: 'Comanda de Barra enviada e impresa'
      };
    }

    return {
      success: true,
      type: 'kitchen_comanda',
      id: 0,
      plainText: '',
      htmlContent: '<div>No hay productos en la orden</div>',
      message: 'No hay productos para comanda'
    };
  }

  /**
   * Generates Cash Shift Cut Ticket (Corte de Caja X/Z)
   */
  public static printShiftReport(shiftId: number): TicketPrintResult {
    const settings = this.getSettings();
    const shift = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(shiftId) as any;
    if (!shift) throw new Error(`Turno de caja #${shiftId} no encontrado`);

    const movements = db.prepare('SELECT * FROM cash_movements WHERE shift_id = ?').all(shiftId) as any[];
    const orders = db.prepare("SELECT * FROM orders WHERE shift_id = ? AND status = 'paid'").all(shiftId) as any[];
    const totalTips = orders.reduce((sum, o) => sum + (o.tip_amount || 0), 0);

    const width = settings.paper_width === '58mm' ? 32 : 42;
    const currency = settings.currency || '$';
    const restName = settings.restaurant_name || 'MI RESTAURANTE';

    const openedAtStr = new Date(shift.opened_at.replace(' ', 'T') + 'Z').toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
    
    let closedAtStr = 'EN CURSO';
    if (shift.closed_at) {
      closedAtStr = new Date(shift.closed_at.replace(' ', 'T') + 'Z').toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
    }
    const openDate = openedAtStr;
    const closeDate = closedAtStr;

    const lines: string[] = [];
    lines.push(this.formatCenter('==============================', width));
    lines.push(this.formatCenter('*** CORTE DE CAJA ***', width));
    lines.push(this.formatCenter(shift.status === 'closed' ? 'CORTE Z (FINAL)' : 'CORTE X (PARCIAL)', width));
    lines.push(this.formatCenter('==============================', width));
    lines.push(this.formatCenter(restName, width));
    lines.push(this.formatLine(`TURNO #${shift.id}`, `CAJERO: ${shift.cashier_name}`, width));
    lines.push(this.formatLine('APERTURA:', openDate, width));
    lines.push(this.formatLine('CIERRE:', closeDate, width));
    lines.push(this.formatDivider('=', width));

    lines.push(this.formatLine('FONDO INICIAL:', `${currency}${shift.initial_amount.toFixed(2)}`, width));
    lines.push(this.formatDivider('-', width));

    lines.push(this.formatCenter('VENTAS POR FORMA DE PAGO', width));
    lines.push(this.formatLine(' (+) EFECTIVO:', `${currency}${shift.total_cash_sales.toFixed(2)}`, width));
    lines.push(this.formatLine(' (+) TARJETAS:', `${currency}${shift.total_card_sales.toFixed(2)}`, width));
    lines.push(this.formatLine(' (+) TRANSFERENCIAS:', `${currency}${shift.total_transfer_sales.toFixed(2)}`, width));
    lines.push(this.formatLine(' (+) VENTAS POR APP:', `${currency}${(shift.total_delivery_sales || 0).toFixed(2)}`, width));
    lines.push(this.formatLine('TOTAL VENTAS:', `${currency}${shift.total_sales.toFixed(2)}`, width));
    lines.push(this.formatLine('TOTAL TICKETS COBRADOS:', `${orders.length}`, width));
    lines.push(this.formatDivider('-', width));

    if (totalTips > 0) {
      lines.push(this.formatCenter('PROPINAS RECAUDADAS', width));
      lines.push(this.formatLine('TOTAL PROPINAS:', `${currency}${totalTips.toFixed(2)}`, width));
      lines.push(this.formatDivider('-', width));
    }

    lines.push(this.formatCenter('MOVIMIENTOS DE CAJA', width));
    lines.push(this.formatLine(' (+) ENTRADAS EXTRA:', `${currency}${shift.total_in_movements.toFixed(2)}`, width));
    lines.push(this.formatLine(' (-) RETIROS/GASTOS:', `${currency}${shift.total_out_movements.toFixed(2)}`, width));
    
    for (const m of movements) {
      const sign = m.type === 'in' ? '+' : '-';
      lines.push(`   ${sign}${currency}${m.amount.toFixed(2)}: ${m.reason}`);
    }
    lines.push(this.formatDivider('=', width));

    const expected = shift.expected_cash || (shift.initial_amount + shift.total_cash_sales + shift.total_in_movements - shift.total_out_movements);
    lines.push(this.formatLine('EFECTIVO ESPERADO EN CAJA:', `${currency}${expected.toFixed(2)}`, width));

    if (shift.actual_cash !== null && shift.actual_cash !== undefined) {
      lines.push(this.formatLine('EFECTIVO CONTADO (REAL):', `${currency}${shift.actual_cash.toFixed(2)}`, width));
      const diff = shift.difference || 0;
      const diffLabel = diff === 0 ? 'CUADRADA (0.00)' : (diff > 0 ? `SOBRANTE (+${currency}${diff.toFixed(2)})` : `FALTANTE (${currency}${diff.toFixed(2)})`);
      lines.push(this.formatLine('DIFERENCIA:', diffLabel, width));
    }

    lines.push(this.formatDivider('=', width));
    if (shift.notes) {
      lines.push(`OBSERVACIONES: ${shift.notes}`);
      lines.push(this.formatDivider('-', width));
    }
    lines.push('');
    lines.push(this.formatCenter('__________________________', width));
    lines.push(this.formatCenter('FIRMA DE CONFORMIDAD', width));
    lines.push('');

    const plainText = lines.join('\n');

    const htmlContent = `
      <div class="ticket-corte" style="font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 340px; margin: 0 auto; padding: 16px; background: #fff; color: #111; border: 1px solid #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 4px; font-size: 13px; line-height: 1.4;">
        <div style="text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 2px;">*** CORTE DE CAJA ***</div>
        <div style="text-align: center; font-weight: bold; color: #0284c7; font-size: 13px;">${shift.status === 'closed' ? 'CORTE (FINAL DE TURNO)' : 'CORTE X (PARCIAL)'}</div>
        <div style="text-align: center; font-size: 12px; color: #555; margin-bottom: 8px;">${restName}</div>
        
        <div style="border-top: 2px solid #000; margin: 6px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>TURNO #${shift.id}</span>
          <span>Cajero: ${shift.cashier_name}</span>
        </div>
        <div style="font-size: 11px; color: #555; margin-top: 2px;">
          <div>Apertura: ${openDate}</div>
          <div>Cierre: ${closeDate}</div>
        </div>

        <div style="border-top: 1px dashed #888; margin: 8px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Fondo Inicial:</span>
          <span>${currency}${shift.initial_amount.toFixed(2)}</span>
        </div>

        <div style="border-top: 1px dashed #888; margin: 8px 0 4px 0;"></div>
        <div style="font-weight: bold; font-size: 11px; text-transform: uppercase; color: #475569;">Ventas por Método de Pago</div>
        <div style="display: flex; justify-content: space-between;">
          <span>(+) Efectivo:</span>
          <span>${currency}${shift.total_cash_sales.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>(+) Tarjetas:</span>
          <span>${currency}${shift.total_card_sales.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>(+) Transferencias:</span>
          <span>${currency}${shift.total_transfer_sales.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>(+) Ventas por App:</span>
          <span>${currency}${(shift.total_delivery_sales || 0).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px; border-top: 1px dotted #aaa; padding-top: 2px;">
          <span>TOTAL VENTAS:</span>
          <span>${currency}${shift.total_sales.toFixed(2)}</span>
        </div>
        <div style="font-size: 11px; color: #64748b;">(${orders.length} tickets cobrados)</div>

        <div style="border-top: 1px dashed #888; margin: 8px 0 4px 0;"></div>
        <div style="font-weight: bold; font-size: 11px; text-transform: uppercase; color: #475569;">Movimientos Manuales</div>
        <div style="display: flex; justify-content: space-between;">
          <span>(+) Entradas extra:</span>
          <span>${currency}${shift.total_in_movements.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>(-) Gastos/Retiros:</span>
          <span>${currency}${shift.total_out_movements.toFixed(2)}</span>
        </div>
        
        ${totalTips > 0 ? `
          <div style="border-top: 1px dashed #ccc; margin: 8px 0;"></div>
          <div style="font-weight: bold; font-size: 13px; text-align: center; margin-bottom: 4px; color: #16a34a;">
            PROPINAS RECAUDADAS
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; color: #16a34a;">
            <span>Total Propinas:</span>
            <span>${currency}${totalTips.toFixed(2)}</span>
          </div>
        ` : ''}

        <div style="border-top: 2px solid #222; margin: 12px 0 8px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
          <span>Efectivo Esperado:</span>
          <span>${currency}${expected.toFixed(2)}</span>
        </div>
        ${shift.actual_cash !== null && shift.actual_cash !== undefined ? `
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 2px;">
            <span>Efectivo Contado:</span>
            <span>${currency}${shift.actual_cash.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-top: 4px; padding: 4px; border-radius: 4px; background: ${(shift.difference || 0) < 0 ? '#fee2e2; color: #b91c1c;' : ((shift.difference || 0) > 0 ? '#fef3c7; color: #b45309;' : '#dcfce7; color: #15803d;') }">
            <span>Diferencia:</span>
            <span>${(shift.difference || 0) === 0 ? 'CUADRADA ($0.00)' : ((shift.difference || 0) > 0 ? `SOBRANTE +${currency}${shift.difference.toFixed(2)}` : `FALTANTE ${currency}${shift.difference.toFixed(2)}`)}</span>
          </div>
        ` : ''}

        ${shift.notes ? `
          <div style="margin-top: 8px; font-size: 11px; background: #f1f5f9; padding: 6px; border-radius: 4px;">
            <b>Observaciones:</b> ${shift.notes}
          </div>
        ` : ''}

        <div style="margin-top: 24px; text-align: center;">
          <div style="border-top: 1px solid #333; width: 80%; margin: 0 auto;"></div>
          <div style="font-size: 10px; margin-top: 4px; color: #555;">Firma de Conformidad</div>
        </div>
      </div>
    `;

    const saved = db.prepare(`
      INSERT INTO printed_tickets (type, reference_id, title, content_plain, content_html)
      VALUES (?, ?, ?, ?, ?)
    `).run('cash_shift', shift.id, `Corte Caja #${shift.id}`, plainText, htmlContent);

    this.sendToPhysicalPrinter(plainText, settings);

    return {
      success: true,
      type: 'cash_shift',
      id: Number(saved.lastInsertRowid),
      plainText,
      htmlContent,
      message: 'Corte de caja generado e impreso'
    };
  }

  /**
   * Driver stub for Physical ESC/POS Printer connection
   * If real printer is configured in settings (usb/network), it attempts to send raw ESC/POS commands
   */
  private static async sendToPhysicalPrinter(text: string, settings: Record<string, string>) {
    if (settings.printer_type === 'mock' || !settings.printer_type) {
      // In mock simulation mode, do not attempt network/USB sockets
      return;
    }

    try {
      if (settings.printer_type === 'network' && settings.printer_ip) {
        const printer = new ThermalPrinter({
          type: PrinterTypes.EPSON,
          interface: `tcp://${settings.printer_ip}:9100`,
          options: {
            timeout: 3000
          },
          width: settings.paper_width === '58mm' ? 32 : 48
        });
        printer.raw(Buffer.from(text, 'utf-8'));
        printer.cut();
        await printer.execute();
      }
    } catch (err) {
      console.warn('Advertencia: No se pudo enviar a la impresora física (Modo virtual activo):', err);
    }
  }

  public static getRecentTickets(limit: number = 20) {
    return db.prepare('SELECT * FROM printed_tickets ORDER BY id DESC LIMIT ?').all(limit);
  }
}
