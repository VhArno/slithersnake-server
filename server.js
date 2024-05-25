import { Server } from "socket.io";

const io = new Server(3000, {
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
    this.creator = false;
  }

  setCreator() {
    this.creator = true;
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
      if (game.gameStarted) {
        socket.emit("gameBusy", gameId, socket.id);
        return;
      }
      game.addPlayer(player);
      player.gameId = gameId;
      players.push(player);
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
    player.setCreator();
    player.joinGame(rId);
    player.room = rId;
    const game = new Game(rId, room.name, room.map, room.mode, room.players, 0);
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
    }
  });

  socket.on("startGame", (room) => {
    const game = openRooms.find((g) => g.id === room.id);
    game.gameStarted = true;
    socket.emit("gameStarted", room.id);
    socket.broadcast.emit("gameStarted", room.id);
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
    const random = 2;
    socket.emit("showPowerUp", powerX, powerY, random);
    socket.broadcast.emit("showPowerUp", powerX, powerY, random);
  });

  socket.on("setPowerUpAvailability", (bool) => {
    socket.emit("setPowerUpAvailability", bool);
    socket.broadcast.emit("setPowerUpAvailability", bool);
  });

  socket.on("activateGhost", (playerId) => {
    socket.emit("activateGhost", playerId);
    socket.broadcast.emit("activateGhost", playerId);
  });

  socket.on("deactivateGhost", (playerId) => {
    socket.emit("deactivateGhost", playerId);
    socket.broadcast.emit("deactivateGhost", playerId);
  });

  socket.on("getRooms", () => {
    socket.emit("rooms", openRooms);
  });

  socket.on("settingsChanged", (r) => {
    socket.broadcast.emit("settingsChanged", r);
  });

  socket.on("disconnect", () => {
    const player = players.find((p) => p.socketId === socket.id);
    if (player) {
      removePlayer(player);
    }
    checkEmptyRooms();
  });

  socket.on("leaveRoom", (plId) => {
    const player = players.find((p) => p.socketId === plId);
    if (player) {
      removePlayer(player);
    }
  });

  function removePlayer(player) {
    const gameId = player.getGameId();
    const game = openRooms.find((g) => g.id === gameId);
    if (game) {
      game.removePlayer(player);
      if (player.creator) {
        game.players[0].setCreator();
        const pl = game.players[0];
        socket.emit("newCreator", pl.socketId);
        socket.broadcast.emit("newCreator", pl.socketId);
      }
      socket.emit("playerLeft", game);
      socket.broadcast.emit("playerLeft", game);
      if (game.players.length === 0) {
        openRooms = openRooms.filter((g) => g.id !== game.id);
      }
    }
  }
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
