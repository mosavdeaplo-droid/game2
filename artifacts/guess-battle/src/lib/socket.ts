import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl =
      (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
      window.location.origin;
    socket = io(socketUrl, {
      path: "/ws/socket.io",
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
