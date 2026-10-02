import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Cliente conectado: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io no ha sido inicializado');
  }
  return io;
}

// Helper events
export function notifyOrderUpdated(order: any) {
  if (io) {
    io.emit('order:updated', order);
  }
}

export function notifyCatalogUpdated() {
  if (io) {
    io.emit('catalog:updated');
  }
}

export function notifyTableUpdated(table: any) {
  if (io) {
    io.emit('table:updated', table);
  }
}

export function notifyShiftUpdated(shift: any) {
  if (io) {
    io.emit('shift:updated', shift);
  }
}

export function notifyTicketPrinted(ticket: any) {
  if (io) {
    io.emit('printer:ticket', ticket);
  }
}

export function notifyKitchenNewComanda(comanda: any) {
  if (io) {
    io.emit('kitchen:new_comanda', comanda);
  }
}
