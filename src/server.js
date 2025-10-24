import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import app from './app.js';
import { attachSocket } from './socket/index.js';
dotenv.config();

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
export const io = new Server(server, { cors: { origin: '*' } });

attachSocket(io);
server.listen(PORT, () => console.log('QuickChat backend listening on ' + PORT));
