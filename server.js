const io = require("socket.io")(3000, {
  cors: {
    origin: "http://localhost:5173",
  },
});

let openRooms = [];
const players = [];

class Player {
  constructor(id, name, level, socketId) {
    this.id = id;
    this.name = name;
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
      console.log("joinRoom", game, player);
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
});
