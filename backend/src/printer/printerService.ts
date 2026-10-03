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
    const restName = settings.restaurant_name || "JJ's Restaurant";
    const address = settings.address || 'Av. Ruiz Cortinez';
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
      timeStyle: 'short',
      hour12: true,
      timeZone: 'America/Mexico_City'
    });

    lines.push(this.formatLine(`TICKET #${order.order_number}`, dateStr, width));
    const dest = order.type === 'dine_in' 
      ? (order.table_name ? (order.table_name.toLowerCase().startsWith('mesa') ? order.table_name.toUpperCase() : `MESA: ${order.table_name.toUpperCase()}`) : (order.table_number ? `MESA: ${order.table_number}` : 'MESA S/N'))
      : (order.type === 'take_out' ? 'PARA LLEVAR' : 'APP');
    lines.push(this.formatLine(`TIPO: ${dest}`, `ORDEN #${order.id}`, width));

    const clientDisplayName = (order.customer_name && order.customer_name.trim().length > 0)
      ? order.customer_name.trim().toUpperCase()
      : (order.type === 'dine_in'
          ? (order.table_name ? order.table_name.toUpperCase() : `MESA ${order.table_number || 'S/N'}`)
          : (order.type === 'take_out' ? 'MOSTRADOR / PARA LLEVAR' : 'DELIVERY / APP'));
    lines.push(this.formatDivider('=', width));
    lines.push(this.formatCenter(`CLIENTE: ${clientDisplayName}`, width));
    lines.push(this.formatDivider('=', width));

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
      <div class="ticket-receipt" style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; width: 100%; max-width: 380px; margin: 0 auto; padding: 10px 4px; background: #fff; color: #000; font-size: 17px; line-height: 1.35; font-weight: 700;">
        <div style="text-align: center; font-weight: 900; font-size: 22px; margin-bottom: 4px; text-transform: uppercase;">${restName}</div>
        ${address ? `<div style="text-align: center; font-size: 14px; font-weight: 800; color: #000;">${address}</div>` : ''}
        ${phone ? `<div style="text-align: center; font-size: 14px; font-weight: 800; color: #000;">Tel: ${phone}</div>` : ''}
        ${rfc ? `<div style="text-align: center; font-size: 14px; font-weight: 800; color: #000;">RFC: ${rfc}</div>` : ''}
        <div style="border-top: 3px dashed #000; margin: 8px 0;"></div>
        
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 19px;">
          <span>TICKET #${order.order_number}</span>
          <span>${dateStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 16px; margin-top: 3px; font-weight: 900;">
          <span>${dest}</span>
          <span>Folio: ${order.id}</span>
        </div>
        <div style="border-top: 3px solid #000; margin: 8px 0 4px 0;"></div>
        <div style="text-align: center; padding: 4px 0;">
          <span style="font-size: 15px; font-weight: 900; letter-spacing: 1px;">CLIENTE:</span>
          <div style="font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; line-height: 1.2; margin-top: 2px;">
            ${clientDisplayName}
          </div>
        </div>
        <div style="border-top: 3px solid #000; margin: 4px 0 8px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 16px; text-transform: uppercase;">
          <span>Cant. / Producto</span>
          <span>Importe</span>
        </div>
        <div style="border-top: 2px dashed #000; margin: 4px 0 8px 0;"></div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${items.map(it => `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 800;">
                <span><b style="font-size: 20px; font-weight: 900;">${it.quantity}x</b> ${it.product_name}</span>
                <span style="font-weight: 900;">${currency}${(it.quantity * it.unit_price).toFixed(2)}</span>
              </div>
              ${it.modifiers && it.modifiers.length > 0 ? `
                <div style="font-size: 15px; font-weight: 800; color: #000; padding-left: 12px; margin-top: 2px;">
                  ↳ ${(() => {
                    const countMap: Record<string, number> = {};
                    it.modifiers.forEach((m: any) => { countMap[m.modifier_name] = (countMap[m.modifier_name] || 0) + 1; });
                    return Object.entries(countMap).map(([name, count]) => `${count}x ${name}`).join(', ');
                  })()}
                </div>
              ` : ''}
              ${it.notes && it.notes.includes('[PARA LLEVAR]') ? `
                <div style="font-size: 15px; font-weight: 900; color: #000; padding-left: 12px; margin-top: 2px;">↳ [PARA LLEVAR]</div>
              ` : ''}
              ${(() => {
                const clean = (it.notes || '').replace(/\[PARA LLEVAR\]/g, '').trim();
                return clean ? `<div style="font-size: 15px; font-weight: 800; color: #000; padding-left: 12px; margin-top: 2px;">↳ ${clean}</div>` : '';
              })()}
            </div>
          `).join('')}
        </div>

        <div style="border-top: 2px dashed #000; margin: 8px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 17px; font-weight: 800;">
          <span>Subtotal:</span>
          <span style="font-weight: 900;">${currency}${order.subtotal.toFixed(2)}</span>
        </div>
        ${order.tax_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800;">
            <span>IVA (${order.tax_rate}%):</span>
            <span>${currency}${order.tax_amount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${order.discount_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; color: #000;">
            <span>Descuento:</span>
            <span>-${currency}${order.discount_amount.toFixed(2)}</span>
          </div>
        ` : ''}
        ${order.tip_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; color: #000;">
            <span>Propina:</span>
            <span>${currency}${order.tip_amount.toFixed(2)}</span>
          </div>
        ` : ''}

        <div style="border-top: 3px solid #000; margin: 10px 0 4px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 24px; font-weight: 900; color: #000;">
          <span>TOTAL:</span>
          <span>${currency}${order.total.toFixed(2)}</span>
        </div>
        <div style="border-top: 3px solid #000; margin: 4px 0 10px 0;"></div>

        ${payments.length > 0 ? `
          <div style="font-size: 15px; margin-top: 4px; font-weight: 800;">
            ${payments.map(p => `
              <div style="display: flex; justify-content: space-between; font-weight: 900;">
                <span>Pago (${({ cash: 'EFECTIVO', card: 'TARJETA', transfer: 'TRANSFERENCIA', app: 'APLICACIÓN' } as Record<string, string>)[p.method] || String(p.method || '').toUpperCase()}):</span>
                <span>${currency}${p.amount.toFixed(2)}</span>
              </div>
              ${p.method === 'cash' && p.amount_tendered ? `
                <div style="display: flex; justify-content: space-between; color: #000;">
                  <span>Entregado:</span>
                  <span>${currency}${p.amount_tendered.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 900; color: #000;">
                  <span>Cambio:</span>
                  <span>${currency}${p.change_amount.toFixed(2)}</span>
                </div>
              ` : ''}
            `).join('')}
          </div>
        ` : ''}

        <div style="border-top: 2px dashed #000; margin: 12px 0 8px 0;"></div>
        <div style="text-align: center; font-size: 15px; font-weight: 900; color: #000;">
          ${footer}
        </div>
        <div style="text-align: center; font-size: 13px; font-weight: 800; color: #000; margin-top: 6px;">
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
    const timeStr = new Date().toLocaleTimeString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'America/Mexico_City' 
    });
    const dest = order.type === 'dine_in' 
      ? (order.table_name ? (order.table_name.toLowerCase().startsWith('mesa') ? order.table_name.toUpperCase() : `MESA: ${order.table_name.toUpperCase()}`) : (order.table_number ? `MESA: ${order.table_number}` : 'MESA S/N'))
      : (order.type === 'take_out' ? '*** ORDEN PARA LLEVAR ***' : '*** ORDEN POR APLICACIÓN (DELIVERY) ***');

    const isKitchen = area === 'COCINA';
    const areaTitle = isKitchen ? 'COCINA' : 'BARRA';
    const itemColHeader = isKitchen ? 'PLATILLO / ESPECIFICACIÓN' : 'BEBIDA / ESPECIFICACIÓN';
    const title = `Comanda ${isKitchen ? 'Cocina' : 'Barra'} #${order.order_number}`;

    const clientDisplayName = (order.customer_name && order.customer_name.trim().length > 0)
      ? order.customer_name.trim().toUpperCase()
      : (order.type === 'dine_in'
          ? (order.table_name ? order.table_name.toUpperCase() : `MESA ${order.table_number || 'S/N'}`)
          : (order.type === 'take_out' ? 'MOSTRADOR / PARA LLEVAR' : 'DELIVERY / APP'));

    const lines: string[] = [];
    lines.push(this.formatDivider('=', width));
    lines.push(this.formatCenter(`*** ${areaTitle} ***`, width));
    lines.push(this.formatDivider('=', width));
    lines.push(this.formatLine(`ORDEN: #${order.order_number}`, `HORA: ${timeStr}`, width));
    lines.push(this.formatLine(`DESTINO: ${dest}`, `FOLIO: ${order.id}`, width));
    lines.push(this.formatDivider('=', width));
    lines.push(this.formatCenter(`CLIENTE: ${clientDisplayName}`, width));
    lines.push(this.formatDivider('=', width));
    lines.push(this.formatLine('CANT', itemColHeader, width));
    lines.push(this.formatDivider('-', width));

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
      <div class="ticket-comanda" style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; width: 100%; max-width: 380px; margin: 0 auto; padding: 8px 4px; background: #fff; color: #000; font-size: 17px; line-height: 1.35; font-weight: 700; page-break-after: always; break-after: page;">
        <div style="border-top: 3px solid #000; margin: 4px 0 2px 0;"></div>
        <div style="text-align: center; font-weight: 900; font-size: 32px; letter-spacing: 3px; text-transform: uppercase; padding: 4px 0; color: #000;">
          *** ${areaTitle} ***
        </div>
        <div style="border-top: 3px solid #000; margin: 2px 0 10px 0;"></div>
        
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 19px;">
          <span>ORDEN #${order.order_number}</span>
          <span>${timeStr}</span>
        </div>
        <div style="border: 3px solid #000; background: transparent; padding: 8px; margin: 8px 0; border-radius: 6px; font-weight: 900; font-size: 22px; text-align: center; text-transform: uppercase;">
          ${dest}
        </div>
        
        <div style="border-top: 3px solid #000; margin: 8px 0 4px 0;"></div>
        <div style="text-align: center; padding: 4px 0;">
          <span style="font-size: 15px; font-weight: 900; letter-spacing: 1px;">CLIENTE:</span>
          <div style="font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; line-height: 1.2; margin-top: 2px;">
            ${clientDisplayName}
          </div>
        </div>
        <div style="border-top: 3px solid #000; margin: 4px 0 8px 0;"></div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${items.map(it => `
            <div style="border-bottom: 2px dashed #000; padding-bottom: 8px;">
              <div style="font-size: 20px; font-weight: 900; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                <div>
                  <span style="border: 2px solid #000; background: transparent; color: #000; padding: 2px 8px; border-radius: 4px; margin-right: 6px; font-weight: 900; font-size: 22px;">${it.quantity}x</span>
                  ${it.product_name}
                </div>
                ${it.notes && it.notes.includes('[PARA LLEVAR]') ? `
                  <span style="border: 2px solid #000; background: transparent; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-weight: 900; white-space: nowrap;">[LLEVAR]</span>
                ` : ''}
              </div>
              ${it.modifiers && it.modifiers.length > 0 ? `
                <div style="padding: 3px 8px; margin-top: 4px; font-size: 17px; font-weight: 800; color: #000; border-left: 3px solid #000; margin-left: 6px;">
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
                  <div style="border-left: 3px solid #000; padding: 4px 8px; margin-top: 4px; font-size: 17px; font-weight: 900; color: #000; text-transform: uppercase; margin-left: 6px;">
                    NOTA: ${clean}
                  </div>
                ` : '';
              })()}
            </div>
          `).join('')}
        </div>

        ${order.notes ? `
          <div style="margin-top: 10px; border: 2px solid #000; padding: 8px; border-radius: 6px; font-size: 17px; font-weight: 900; color: #000; text-transform: uppercase;">
            <b>Nota general:</b> ${order.notes}
          </div>
        ` : ''}

        <div style="border-top: 3px dashed #000; margin: 12px 0 6px 0;"></div>
        <div style="text-align: center; font-size: 15px; font-weight: 900; color: #000;">
          --- FIN DE COMANDA ${areaTitle} ---
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
    const restName = settings.restaurant_name || "JJ's Restaurant";

    const openedAtStr = new Date(shift.opened_at.replace(' ', 'T') + 'Z').toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: true,
      timeZone: 'America/Mexico_City'
    });
    
    let closedAtStr = 'EN CURSO';
    if (shift.closed_at) {
      closedAtStr = new Date(shift.closed_at.replace(' ', 'T') + 'Z').toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short',
        hour12: true,
        timeZone: 'America/Mexico_City'
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
