/**
 * AGENTE DE IMPRESIÓN LOCAL (PRINT BRIDGE)
 * 
 * Este pequeño script corre en la computadora donde esté conectada la impresora
 * térmica (USB o Red Ethernet). Se conecta en tiempo real al backend (Koyeb o Nube)
 * y en cuanto un mesero o cajero genera una comanda o ticket, este agente lo recibe
 * y lo imprime físicamente en el local sin intervención manual.
 * 
 * Uso:
 *   node scripts/print-bridge.js
 * 
 * Variables de entorno (opcionales):
 *   BACKEND_URL=https://tu-pos.koyeb.app
 *   PRINTER_IP=192.168.1.200 (para impresoras de red)
 */

import { io } from 'socket.io-client';
import net from 'net';

const BACKEND_URL = process.env.BACKEND_URL || 'https://punto-venta-production-a665.up.railway.app';
const PRINTER_IP = process.env.PRINTER_IP || '192.168.1.65'; // Epson TM-T88VI (confirmada en red)
const PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;

console.log('====================================================');
console.log('🖨️  AGENTE DE IMPRESIÓN LOCAL (POS RESTAURANTE)');
console.log('====================================================');
console.log(`Conectando a servidor: ${BACKEND_URL}`);

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true
});

socket.on('connect', () => {
  console.log('🟢 Conectado exitosamente al servidor POS en la nube.');
  console.log('Esperando órdenes y comandas para imprimir...\n');
});

socket.on('disconnect', () => {
  console.warn('🔴 Conexión perdida con el servidor. Reconectando...');
});

// Evento cuando se manda comanda a cocina/barra
socket.on('kitchen:new_comanda', (data) => {
  console.log(`\n🔔 NUEVA COMANDA RECIBIDA: Orden #${data?.order?.order_number}`);
  if (data?.ticket?.plainText) {
    printToPrinter(data.ticket.plainText);
  }
});

// Evento cuando se imprime cualquier ticket
socket.on('ticket:printed', (ticket) => {
  console.log(`📄 TICKET REGISTRADO: ${ticket.title} (Tipo: ${ticket.type})`);
});

function printToPrinter(text) {
  if (PRINTER_IP) {
    console.log(`Enviando a impresora de red (${PRINTER_IP}:${PRINTER_PORT})...`);
    const client = new net.Socket();
    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      client.write(Buffer.from(text + '\n\n\n\x1d\x56\x00', 'utf-8')); // Texto + Corte ESC/POS
      client.end();
      console.log('✅ Impreso con éxito.');
    });
    client.on('error', (err) => {
      console.error('❌ Error enviando a la impresora física:', err.message);
    });
  } else {
    console.log('ℹ️ [MODO SIMULACIÓN] Texto que saldría en la impresora física:\n');
    console.log(text);
  }
}
