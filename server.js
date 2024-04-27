const io = require("socket.io")(3000, {
  cors: {
    origin: "http://localhost:5173",
  },
});

let openRooms = [];
const players = [];

class Player {
  constructor(id, username, level, socketId) {
    this.id = id;
    this.username = username;
    this.level = level;
    this.socketId = socketId;
    this.gameId = null;
  }

  joinGame(gameId) {
    this.gameId = gameId;
  }
}

class Game {
  players = [];
  map = null;
  gamemode = null;

  constructor(id) {
    this.id = id;
  }

  addPlayer(player) {
    this.players.push(player);
  }

  removePlayer(player) {
    this.players = this.players.filter((p) => p.id !== player.id);
  }
}

io.on("connection", (socket) => {
  console.log("connected: " + socket.id);
  socket.on("disconnect", () => {
    const player = players.find((p) => p.socketId === socket.id);
    if (player) {
      const game = openRooms.find((g) => g.id === player.gameId);
      if (game) {
        game.removePlayer(player);
        if (game.players.length === 0) {
          openRooms = openRooms.filter((g) => g.id !== game.id);
        }
      }
    }
  });

  socket.on("joinRoom", (gameId, p) => {
    const game = openRooms.find((g) => g.id === gameId);
    const player = new Player(
      p._value.id,
      p._value.username,
      p._value.level,
      socket.id
    );
    if (game && player) {
      game.addPlayer(player);
      player.gameId = gameId;
      players.push(player);

      console.log('player joined room');
      socket.broadcast.emit("joinedRoom", game);
      socket.emit("joinedRoom", game);
    }
  });

  socket.on("createRoom", (gameId, p) => {
    const player = new Player(
      p._value.id,
      p._value.username,
      p._value.level,
      socket.id
    );
    player.joinGame(gameId);
    player.gameId = gameId;
    const game = new Game(gameId);
    game.addPlayer(player);
    openRooms.push(game);
    players.push(player);
    socket.emit("joinedRoom", game);
  });

  socket.on("getPlayers", (gameId) => {
    const game = openRooms.find((g) => g.id === gameId);
    if (game) {
      socket.emit("players", game);
    }
  });

  socket.on('startGame', (roomId) => {
    const game = openRooms.find((g) => g.id === roomId);
    // game.map = map;
    // game.gamemode = gamemode;
    console.log('game started');
    console.log(roomId)
    socket.broadcast.emit('gameStarted', roomId);
    socket.emit('gameStarted', roomId);
  });

  socket.on('getPlayerData', () => {
    console.log('player data requested');
    socket.emit('playerData');
    socket.broadcast.emit('playerData');
  });
});
