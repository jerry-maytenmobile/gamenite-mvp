const express = require('express');
// create express serverapp
const serverapp = express();
// create server
const server = require('http').Server(serverapp);
// connect server to socket
const io = require('socket.io')(server);
// get random roomId using uuid
// const { v4: uuidV4 } = require('uuid');
// keep track of players and player names
let playernames = [];
let playerscores = [];

serverapp.use(express.static('public'));

serverapp.get('/', (req, res) => {
  // server responds by redirecting root to /room
  res.redirect(`/dixet`);
});

serverapp.get('/:room', (req, res) => {
  // get roomid from URL
  // res.render('room', { roomId: req.params.room });
  res.json( { roomId: req.params.room } );
});

// when a client connects to server
io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    console.log(roomId, userId);
    socket.join(roomId);
    // broadcast a user-connected event to all clients -> this will trigger event on client-side
    socket.to(roomId).broadcast.emit('user-connected', userId);

    // add user as a new player
    playernames.push(userId);
    playerscores.push(0);
    let playerinfo = {'playernames': playernames, 'playerscores': playerscores};
    io.in(roomId).emit('update-player', playerinfo);

    // when user disconnects
    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId);
      playernames.splice(playernames.indexOf(userId), 1);
      playerscores.splice(playernames.indexOf(userId), 1);
      io.in(roomId).emit('update-player', playerinfo);
    });
  });
});
// server listen on port 3000
server.listen(3000);
