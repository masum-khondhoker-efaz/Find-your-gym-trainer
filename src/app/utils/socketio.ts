import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from './prisma';
import { socketAuth } from '../middlewares/socketAuth';
import { UserRoleEnum } from '@prisma/client';

const onlineUsers = new Set<string>();
const userSockets = new Map<string, Socket>();

export function setupSocketIO(server: HTTPServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
    },
  });

  const messagesNameSpace = io.of('/messages');
  messagesNameSpace.use(socketAuth);

  messagesNameSpace.on('connection', async (socket: Socket) => {
    console.log('✅ User connected to messages namespace');
    const user = (socket as any).user;
    const { id } = user;

    onlineUsers.add(id);
    userSockets.set(id, socket);

    messagesNameSpace.emit('userStatus', { userId: id, isOnline: true });
    messagesNameSpace.emit('onlineUsers', Array.from(onlineUsers));

    socket.on('disconnect', () => {
      console.log('❌ User disconnected from messages namespace');
      onlineUsers.delete(id);
      userSockets.delete(id);
      messagesNameSpace.emit('userStatus', { userId: id, isOnline: false });
      messagesNameSpace.emit('onlineUsers', Array.from(onlineUsers));
    });

    socket.on('message', async payload => {
      try {
        if (!payload.receiverId || !payload.message) {
          socket.emit('error', { message: 'Receiver ID or message is required' });
          return;
        }

        // Prevent self-messaging
        if (payload.receiverId === id) {
          socket.emit('error', { message: 'Cannot send message to yourself' });
          return;
        }

        // Check if user is a trainer and verify subscription
        if (user.role === UserRoleEnum.TRAINER) {
          if (!user.isSubscribed || user.subscriptionEnd < new Date()) {
            socket.emit('error', {
              message: 'Active subscription required to send messages. Please subscribe to continue chatting.',
            });
            return;
          }
        }

        // Fetch receiver details
        const receiver = await prisma.user.findUnique({
          where: { id: payload.receiverId },
          select: { 
            id: true, 
            role: true, 
            isSubscribed: true, 
            subscriptionEnd: true 
          },
        });

        if (!receiver) {
          socket.emit('error', { message: 'Receiver not found' });
          return;
        }

        // Check if receiver is a trainer and has active subscription
        if (receiver.role === UserRoleEnum.TRAINER) {
          if (!receiver.isSubscribed || !receiver.subscriptionEnd || receiver.subscriptionEnd < new Date()) {
            socket.emit('error', {
              message: 'This trainer does not have an active subscription and cannot receive messages.',
            });
            return;
          }
        }

        // Find or create room
        let room = await prisma.room.findFirst({
          where: {
            OR: [
              { senderId: id, receiverId: payload.receiverId },
              { senderId: payload.receiverId, receiverId: id },
            ],
          },
        });

        if (!room) {
          room = await prisma.room.create({
            data: {
              senderId: id,
              receiverId: payload.receiverId,
            },
          });
        }

        // Create chat message
        const chat = await prisma.chat.create({
          data: {
            senderId: id,
            receiverId: payload.receiverId,
            roomId: room.id,
            message: payload.message,
            images: payload.images || [],
          },
        });

        // Emit to room
        const roomName = [id, payload.receiverId].sort().join('-');
        socket.join(roomName);
        
        const receiverSocket = userSockets.get(payload.receiverId);
        if (receiverSocket) {
          receiverSocket.join(roomName);
        }

        messagesNameSpace.to(roomName).emit('message', chat);

        // Update message lists
        await emitMessageList(id);
        if (receiverSocket && receiverSocket.connected) {
          await emitMessageList(payload.receiverId);
        }

      } catch (error) {
        console.error('Error handling message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('fetchChats', async payload => {
      try {
        if (!payload || !payload.receiverId) {
          socket.emit('error', { message: 'Receiver ID is required' });
          return;
        }

        // Check sender subscription if trainer
        if (user.role === UserRoleEnum.TRAINER) {
          if (!user.isSubscribed || user.subscriptionEnd < new Date()) {
            socket.emit('error', {
              message: 'Active subscription required to view messages.',
            });
            return;
          }
        }

        const receiver = await prisma.user.findUnique({
          where: { id: payload.receiverId },
          select: {
            id: true,
            fullName: true,
            image: true,
            role: true,
            isSubscribed: true,
            subscriptionEnd: true,
          },
        });

        if (!receiver) {
          socket.emit('error', { message: 'Receiver not found' });
          return;
        }

        // Check receiver subscription if trainer
        if (receiver.role === UserRoleEnum.TRAINER) {
          if (!receiver.isSubscribed || !receiver.subscriptionEnd || receiver.subscriptionEnd < new Date()) {
            socket.emit('error', {
              message: 'This trainer does not have an active subscription.',
            });
            return;
          }
        }

        const room = await prisma.room.findFirst({
          where: {
            OR: [
              { senderId: id, receiverId: payload.receiverId },
              { senderId: payload.receiverId, receiverId: id },
            ],
          },
        });

        if (!room) {
          socket.emit('noRoomFound', { message: 'No conversation found' });
          return;
        }

        // Mark messages as read
        await prisma.chat.updateMany({
          where: {
            roomId: room.id,
            receiverId: id,
            isRead: false,
          },
          data: {
            isRead: true,
          },
        });

        const chats = await prisma.chat.findMany({
          where: {
            roomId: room.id,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        socket.emit('chats', {
          chats,
          receiver: {
            id: receiver.id,
            name: receiver.fullName,
            image: receiver.image,
          },
        });

        // Join room
        const roomName = [id, payload.receiverId].sort().join('-');
        socket.join(roomName);
        const receiverSocket = userSockets.get(payload.receiverId);
        if (receiverSocket) {
          receiverSocket.join(roomName);
        }

        // Update message lists
        await emitMessageList(id);

      } catch (error) {
        console.error('Error fetching chats:', error);
        socket.emit('error', { message: 'Failed to fetch chats' });
      }
    });

    socket.on('messageList', async () => {
      await emitMessageList(id);
    });

    socket.on('unReadMessages', async payload => {
      try {
        if (!payload || !payload.receiverId) {
          socket.emit('error', { message: 'Receiver ID is required' });
          return;
        }

        const room = await prisma.room.findFirst({
          where: {
            OR: [
              { senderId: id, receiverId: payload.receiverId },
              { senderId: payload.receiverId, receiverId: id },
            ],
          },
        });

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const unreadCount = await prisma.chat.count({
          where: {
            roomId: room.id,
            isRead: false,
            receiverId: id,
          },
        });

        if (unreadCount === 0) {
          socket.emit('noUnreadMessages', { message: 'No unread messages' });
          return;
        }

        const unreadMessages = await prisma.chat.findMany({
          where: {
            roomId: room.id,
            isRead: false,
            receiverId: id,
          },
        });

        socket.emit('unReadMessages', { messages: unreadMessages, count: unreadCount });

      } catch (error) {
        console.error('Error fetching unread messages:', error);
        socket.emit('error', { message: 'Failed to fetch unread messages' });
      }
    });

    async function emitMessageList(userId: string) {
      try {
        const rooms = await prisma.room.findMany({
          where: {
            OR: [{ senderId: userId }, { receiverId: userId }],
          },
          include: {
            chat: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        });
        // Get unique user IDs from rooms
        // Prevent self-messaging
        if (payload.receiverId === id) {
          socket.emit('error', { message: 'Cannot send message to yourself' });
          return;
        }

        // Check if user is a trainer and verify subscription
        if (user.role === UserRoleEnum.TRAINER) {
          if (!user.isSubscribed || user.subscriptionEnd < new Date()) {
            socket.emit('error', {
              message: 'Active subscription required to send messages. Please subscribe to continue chatting.',
            });
            return;
          }
        }

        // Fetch receiver details
        const receiver = await prisma.user.findUnique({
          where: { id: payload.receiverId },
          select: { 
            id: true, 
            role: true, 
            isSubscribed: true, 
            subscriptionEnd: true 
          },
        });

        if (!receiver) {
          socket.emit('error', { message: 'Receiver not found' });
          return;
        }
        // Get unique rooms

        const userIds = Array.from(
          new Set(
            rooms
              .map(room => [room.senderId, room.receiverId])
              .flat()
              .filter((uid): uid is string => !!uid),
          ),
        );

        const userInfos = await prisma.user.findMany({
          where: {
            id: { in: userIds },
          },
          select: {
            id: true,
            fullName: true,
            image: true,
            role: true,
          },
        });

        const currentUser = userInfos.find(u => u.id === userId);

        const roomsWithUnreadMessages = await Promise.all(
          rooms.map(async room => {
            const unReadMessagesCount = await prisma.chat.count({
              where: {
                roomId: room.id,
                isRead: false,
                receiverId: userId,
              },
            });

            const otherUserId =
              room.senderId === userId ? room.receiverId : room.senderId;
            const otherUser = userInfos.find(u => u.id === otherUserId);

            return {
              chat: room.chat[0],
              unReadMessagesCount,
              senderName: currentUser?.fullName || null,
              senderImage: currentUser?.image || null,
              receiverName: otherUser?.fullName || null,
              receiverImage: otherUser?.image || null,
              receiverRole: otherUser?.role || null,
              lastMessageAt: room.chat[0]?.createdAt || null,
              roomId: room.id,
            };
          }),
        );

        const sortedRooms = roomsWithUnreadMessages.sort((a, b) => {
          if (!a.lastMessageAt && !b.lastMessageAt) return 0;
          if (!a.lastMessageAt) return 1;
          if (!b.lastMessageAt) return -1;
          return (
            new Date(b.lastMessageAt).getTime() -
            new Date(a.lastMessageAt).getTime()
          );
        });

        const targetSocket = userSockets.get(userId);
        if (targetSocket) {
          targetSocket.emit('messageList', sortedRooms.length ? sortedRooms : []);
        }
      } catch (error) {
        console.error('Error emitting message list:', error);
      }
    }
  });

  return io;
}