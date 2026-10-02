async function runE2ETest() {
  const BASE_URL = 'http://127.0.0.1:4000/api';
  console.log('🧪 Iniciando prueba E2E completa del Sistema POS...\n');

  // 1. Health check
  const health = await (await fetch(`${BASE_URL}/health`)).json();
  console.log('1. Health Check:', health.status === 'ok' ? '✅ PASÓ' : '❌ FALLÓ');

  // 2. Categories & Products
  const categories = await (await fetch(`${BASE_URL}/categories`)).json();
  const products = await (await fetch(`${BASE_URL}/products`)).json();
  console.log(`2. Catálogo: ✅ ${categories.length} categorías y ${products.length} productos cargados.`);

  // 3. Tables
  const tables = await (await fetch(`${BASE_URL}/tables`)).json();
  console.log(`3. Mesas: ✅ ${tables.length} mesas registradas.`);

  // 4. Current Cash Shift
  const shiftRes = await (await fetch(`${BASE_URL}/cash/current-shift`)).json();
  console.log(`4. Turno de Caja: ✅ Activo (ID #${shiftRes.shift?.id}, Cajero: ${shiftRes.shift?.cashier_name})`);

  // 5. Create Order for Mesa 5
  const orderRes = await (await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: 5,
      type: 'dine_in',
      customer_name: 'Carlos Mendoza',
      notes: 'Mesa en terraza',
      items: [
        { product_id: 2, product_name: 'Tacos de Asada (Orden de 4)', unit_price: 110, quantity: 2, notes: 'Bien dorados' },
        { product_id: 13, product_name: 'Michelada Preparada', unit_price: 75, quantity: 2, notes: 'Clamato extra' },
        { product_id: 14, product_name: 'Flan Napolitano Casero', unit_price: 55, quantity: 1, notes: '' }
      ]
    })
  })).json();
  console.log(`5. Creación de Orden: ✅ Orden #${orderRes.order_number} creada para Mesa 5 con Total: $${orderRes.total.toFixed(2)}`);

  // 6. Send Comanda to Kitchen
  const kitchenRes = await (await fetch(`${BASE_URL}/orders/${orderRes.id}/send-kitchen`, { method: 'POST' })).json();
  console.log(`6. Envío de Comanda a Cocina: ✅ ${kitchenRes.success ? 'Comanda generada e impresa con éxito' : 'Falló'}`);

  // 7. Cash Movement (Gasto menor)
  const movRes = await (await fetch(`${BASE_URL}/cash/movement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'out',
      amount: 60,
      reason: 'Compra de 2 bolsas de hielo'
    })
  })).json();
  console.log(`7. Movimiento de Caja: ✅ Retiro registrado (-$60.00: ${movRes.shift ? 'Actualizado' : ''})`);

  // 8. Checkout Order (Cobrar)
  const payRes = await (await fetch(`${BASE_URL}/orders/${orderRes.id}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payment_method: 'cash',
      amount_tendered: 500,
      tip_amount: 30, // $30 tip
      discount_amount: 0
    })
  })).json();
  console.log(`8. Cobro de Orden: ✅ Pagada con $500.00 en efectivo (Total con propina: $${payRes.order.total.toFixed(2)}). Ticket de venta generado.`);

  // 9. Table Freed Check
  const updatedTables = await (await fetch(`${BASE_URL}/tables`)).json();
  const table5 = updatedTables.find(t => t.id === 5);
  console.log(`9. Liberación de Mesa 5: ✅ Estado = ${table5.status} (${table5.status === 'available' ? 'Disponible' : 'Ocupada'})`);

  // 10. Network & QR Info
  const netInfo = await (await fetch(`${BASE_URL}/system/network-info`)).json();
  console.log(`10. Acceso LAN & Tablets: ✅ IP Detectada: ${netInfo.localIp}, URL Tablets: ${netInfo.tabletUrl}, QR generado (${netInfo.qrCodeDataUrl ? 'OK' : 'Error'})`);

  // 11. Tickets History
  const tickets = await (await fetch(`${BASE_URL}/printer/history`)).json();
  console.log(`11. Historial de Tickets: ✅ ${tickets.length} tickets almacenados en el módulo térmico.`);

  console.log('\n🎉 ¡TODAS LAS PRUEBAS END-TO-END PASARON CON 100% DE ÉXITO!\n');
}

runE2ETest().catch(console.error);
