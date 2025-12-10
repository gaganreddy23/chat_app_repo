// socket/index.js
const express = require('express');
const { Server } = require('socket.io');
const http  = require('http');

const getUserDetailsFromToken = require('../helpers/getUserDetailsFromToken');
const UserModel = require('../models/UserModel');
const { ConversationModel, MessageModel } = require('../models/ConversationModel');
const getConversation = require('../helpers/getConversation');

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://192.168.49.2:30000';
const WHITELIST = [
  CLIENT_ORIGIN,
  'http://localhost:3000',
  'http://localhost:30000'
];

const io = new Server(server, {
  cors: {
    origin: WHITELIST,
    allowedHeaders: ['Content-Type','Authorization'],
    credentials: true
  }
});

/**
 * onlineUsers: Map<userIdString, Set<socketId>>
 * - Handles multiple sockets per user (multiple tabs/devices)
 */
const onlineUsers = new Map();

function addOnlineSocket(userId, socketId) {
  const set = onlineUsers.get(userId) || new Set();
  set.add(socketId);
  onlineUsers.set(userId, set);
}

function removeOnlineSocket(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
  else onlineUsers.set(userId, set);
}

function getOnlineList() {
  // return array of userIds
  return Array.from(onlineUsers.keys());
}

// debug route to see who's online
app.get('/debug/online', (req, res) => {
  const summary = {};
  for (const [userId, set] of onlineUsers.entries()) {
    summary[userId] = Array.from(set);
  }
  res.json(summary);
});

io.on('connection', async (socket) => {
  console.log('Socket connected', socket.id);

  try {
    // Authenticate: token should be passed in handshake.auth.token
    const token = socket.handshake?.auth?.token;
    if (!token) {
      console.warn('Connection without token — disconnecting', socket.id);
      socket.emit('error', 'Authentication token missing');
      return socket.disconnect(true);
    }

    const user = await getUserDetailsFromToken(token);
    if (!user) {
      console.warn('Invalid token/user not found — disconnecting', socket.id);
      socket.emit('error', 'Invalid token');
      return socket.disconnect(true);
    }

    const userIdStr = user._id.toString();

    // join the user's personal room and track socket
    socket.join(userIdStr);
    addOnlineSocket(userIdStr, socket.id);

    // attach user info to socket for later use
    socket.user = {
      id: userIdStr,
      email: user.email,
      name: user.name
    };

    // broadcast list of online user ids
    io.emit('onlineUser', getOnlineList());
    console.log(`User ${userIdStr} joined. sockets for user:`, Array.from(onlineUsers.get(userIdStr) || []));

    /*** message page: client asks for a particular user's info and existing messages ***/
    socket.on('message-page', async (userId) => {
      try {
        if (!userId) return;
        const uid = String(userId);

        const userDetails = await UserModel.findById(uid).select('-password');
        const payload = {
          _id: userDetails?._id,
          name: userDetails?.name,
          email: userDetails?.email,
          profile_pic: userDetails?.profile_pic,
          online: onlineUsers.has(uid)
        };
        socket.emit('message-user', payload);

        const conv = await ConversationModel.findOne({
          $or: [
            { sender: user._id, receiver: uid },
            { sender: uid, receiver: user._id }
          ]
        }).populate('messages').sort({ updatedAt: -1 });

        socket.emit('message', conv?.messages || []);
      } catch (err) {
        console.error('message-page error', err);
      }
    });

    /*** new message: server uses authenticated user id as sender (DO NOT trust client-provided sender) ***/
    socket.on('new message', async (data) => {
      try {
        // ensure we have a receiver and text or attachment
        const senderId = userIdStr;
        const receiverId = data && data.receiver ? String(data.receiver) : null;
        const text = data?.text || '';
        const imageUrl = data?.imageUrl || null;
        const videoUrl = data?.videoUrl || null;

        if (!receiverId) {
          console.warn('new message missing receiver', { senderId, rawData: data });
          return;
        }

        // find or create conversation between sender and receiver
        let conversation = await ConversationModel.findOne({
          $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId }
          ]
        });

        if (!conversation) {
          conversation = await new ConversationModel({
            sender: senderId,
            receiver: receiverId
          }).save();
        }

        // create & save message
        const message = new MessageModel({
          text,
          imageUrl,
          videoUrl,
          msgByUserId: senderId,
          seen: false
        });
        const saveMessage = await message.save();

        // push message id into conversation
        await ConversationModel.updateOne(
          { _id: conversation._id },
          { $push: { messages: saveMessage._id } }
        );

        // re-fetch populated conversation messages
        const getConversationMessage = await ConversationModel.findOne({
          $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId }
          ]
        }).populate('messages').sort({ updatedAt: -1 });

        // emit the updated messages to both sender and receiver rooms
        io.to(senderId).emit('message', getConversationMessage?.messages || []);
        io.to(receiverId).emit('message', getConversationMessage?.messages || []);

        // update conversation lists for both users
        const conversationSender = await getConversation(senderId);
        const conversationReceiver = await getConversation(receiverId);

        io.to(senderId).emit('conversation', conversationSender);
        io.to(receiverId).emit('conversation', conversationReceiver);

      } catch (err) {
        console.error('new message error', err);
      }
    });

    /*** sidebar: request conversation list for a user ***/
    socket.on('sidebar', async (currentUserId) => {
      try {
        if (!currentUserId) return;
        const conversation = await getConversation(String(currentUserId));
        socket.emit('conversation', conversation);
      } catch (err) {
        console.error('sidebar error', err);
      }
    });

    /*** seen: mark messages as seen for a conversation where msgByUserId is the other user ***/
    socket.on('seen', async (msgByUserId) => {
      try {
        if (!msgByUserId) return;
        const otherId = String(msgByUserId);

        const conversation = await ConversationModel.findOne({
          $or: [
            { sender: user._id, receiver: otherId },
            { sender: otherId, receiver: user._id }
          ]
        });

        const conversationMessageId = conversation?.messages || [];
        await MessageModel.updateMany(
          { _id: { $in: conversationMessageId }, msgByUserId: otherId },
          { $set: { seen: true } }
        );

        const conversationSender = await getConversation(userIdStr);
        const conversationReceiver = await getConversation(otherId);

        io.to(userIdStr).emit('conversation', conversationSender);
        io.to(otherId).emit('conversation', conversationReceiver);
      } catch (err) {
        console.error('seen error', err);
      }
    });

    /*** disconnect handler: remove this socket from onlineUsers and broadcast updated list ***/
    socket.on('disconnect', (reason) => {
      try {
        removeOnlineSocket(userIdStr, socket.id);
        io.emit('onlineUser', getOnlineList());
        console.log(`User ${userIdStr} disconnected (${reason}). remaining sockets:`, Array.from(onlineUsers.get(userIdStr) || []));
      } catch (err) {
        console.error('disconnect error', err);
      }
    });

  } catch (error) {
    console.error('io connection handler error', error);
    // defensive: if something unexpected happens, disconnect the socket
    try { socket.disconnect(true); } catch (e) { /* ignore */ }
  }
});

module.exports = {
  app,
  server
};
