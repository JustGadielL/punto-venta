import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || undefined;
    socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('🟢 Conectado al servidor en tiempo real (Socket.io)');
    });

    socket.on('disconnect', () => {
      console.warn('🔴 Desconectado del servidor en tiempo real');
    });
  }

  return socket;
}
