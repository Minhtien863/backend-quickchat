import jwt from 'jsonwebtoken';

export function attachSocket(io) {
  io.use((socket, next) => {
    try {
      const token = (socket.handshake.headers['authorization'] || '').replace('Bearer ', '');
      if (!token) return next(new Error('no auth'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch { next(new Error('bad auth')); }
  });

  io.on('connection', (socket) => {
    socket.on('room:join', ({ conversationId }) => socket.join(`conv:${conversationId}`));
    socket.on('room:leave', ({ conversationId }) => socket.leave(`conv:${conversationId}`));
    // demo: phát lại message client gửi (sau này sẽ phát sau khi lưu DB)
    socket.on('message:send', (msg) => io.to(`conv:${msg.conversationId}`).emit('message:new', msg));
  });
}
