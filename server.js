const io = require("socket.io")(3000, {
  cors: {
    origin: "http://localhost:5173",
  },
});

let openRooms = [];
const players = [];
let snake = { data: [], id: "" };

class Player {
  constructor(id, username, level, socketId) {
    this.id = id;
    this.username = username;
    this.level = level;
    this.socketId = socketId;
    this.room = null;
  }

  joinGame(gameId) {
    this.gameId = gameId;
  }

  getGameId() {
    return this.gameId;
  }
}

class Game {
  players = [];

  constructor(id, name, map, mode, players, ping) {
    this.id = id;
    this.name = name;
    this.map = map;
    this.mode = mode;
    this.players = players;
    this.ping = ping;
    this.gameStarted = false;
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
      if (game.gameStarted){
        socket.emit("gameBusy", gameId, socket.id);
        return;
      }
      game.addPlayer(player);
      player.gameId = gameId;
      players.push(player);
      console.log("player joined room: " + game.id);
      socket.broadcast.emit("joinedRoom", game);
      socket.emit("joinedRoom", game);
    }
  });

  socket.on("createRoom", (room, p, rId) => {
    const player = new Player(
      p._value.id,
      p._value.username,
      p._value.level,
      socket.id
    );
    player.joinGame(rId);
    player.room = rId;
    const game = new Game(
      rId,
      room.name,
      room.map,
      room.mode,
      room.players,
      0
    );
    game.addPlayer(player);
    openRooms.push(game);
    players.push(player);
    socket.emit("joinedRoom", game);
    socket.broadcast.emit("newRoom", openRooms);
  });

  socket.on("getPlayers", (gameId) => {
    const game = openRooms.find((g) => g.id === gameId);
    if (game) {
      console.log("players sent");
      socket.emit("players", game);
      socket.broadcast.emit("players", game);
    }
  });

  socket.on("startGame", (roomId) => {
    const game = openRooms.find((g) => g.id === roomId);
    // game.map = map;
    // game.gamemode = gamemode;
    game.gameStarted = true;
    console.log("game started");
    console.log(roomId);
    socket.broadcast.emit("gameStarted", roomId);
    socket.emit("gameStarted", roomId);
  });

  socket.on("getPlayerData", () => {
    // console.log(test);
    socket.emit("getData", snake);
    socket.broadcast.emit("getData", snake);
  });

  socket.on("sendPlayerData", (snakeData, playerId) => {
    console.log("player data sent");
    snake = { data: snakeData, id: playerId };
    // socket.emit('sendData');
    // socket.broadcast.emit('sendData');
  });

  socket.on("generateFood", (foodX, foodY) => {
    socket.emit("showFood", foodX, foodY);
    socket.broadcast.emit("showFood", foodX, foodY);
  });

  socket.on("generatePowerUp", (powerX, powerY) => {
    // random = Math.floor(Math.random * 3 + 1)
    //testwaarde
    random = 2
    socket.emit("showPowerUp", powerX, powerY, random);
    socket.broadcast.emit("showPowerUp", powerX, powerY, random);
  });

  socket.on('setPowerUpAvailability', (bool) => {
    socket.emit('setPowerUpAvailability', bool);
    socket.broadcast.emit('setPowerUpAvailability', bool);
  });

  socket.on('activateGhost', (playerId) => {
    socket.emit('activateGhost', playerId);
    socket.broadcast.emit('activateGhost', playerId);
  });

  socket.on('deactivateGhost', (playerId) => {
    socket.emit('deactivateGhost', playerId);
    socket.broadcast.emit('deactivateGhost', playerId);
  });

  socket.on('getRooms', () => {
    console.log(openRooms)
    socket.emit('rooms', openRooms);
  });

  socket.on("settingsChanged", (r) => {
    socket.broadcast.emit("settingsChanged", r);
  });

  socket.on("disconnect", () => {
    const player = players.find((p) => p.socketId === socket.id);
    if (player) {
      console.log("player disconnected: " + player.id);
      const gameId = player.getGameId();
      const game = openRooms.find((g) => g.id === gameId);
      if (game) {
        game.removePlayer(player);
        socket.emit("playerLeft", game);
        socket.broadcast.emit("playerLeft", game);
        console.log("player left room: " + game.id);
        if (game.players.length === 0) {
          openRooms = openRooms.filter((g) => g.id !== game.id);
        }
      }
    }
  });
  checkEmptyRooms();
});

function checkEmptyRooms() {
  //check if there are empty rooms and remove them
  openRooms.forEach((room) => {
    if (room.players.length === 0) {
      openRooms = openRooms.filter((g) => g.id !== room.id);
    }
  });
}

/* Add a duel in db when game starts */
// -> post .../api/duels
async function postDuelDb(duel_id, score) {
  const url = `${import.meta.env.VITE_BASE_URL}/api/duels`;

  const body = {
    duel_id: duel_id,
    score: score,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error posting duel:', error);
    throw error;
  }
}
/*// Example usage
postDuelDb('12345', 100)
  .then(data => {
    console.log('Duel posted successfully:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });*/

-
/* patch a duel (end time) when game ends */
// -> patch .../api/duels
async function patchDuelDb(duel_id) {
  const url = `${import.meta.env.VITE_BASE_URL}/api/duels`;

  const body = {
    duel_id: duel_id,
  };

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error patching duel:', error);
    throw error;
  }
}

/*// Example usage
patchDuelDb('12345')
  .then(data => {
    console.log('Duel patched successfully:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });*/
