import { Server } from "socket.io";
import { config } from "dotenv";

config();

const io = new Server(3000, {
  cors: {
    origin: process.env.CLIENT_URL,
  },
});

let openRooms = [];
let players = [];
let snake = { data: [], id: "" };

class Player {
  constructor(id, username, level, socketId) {
    this.id = id;
    this.username = username;
    this.level = level;
    this.socketId = socketId;
    this.room = null;
    this.creator = false;
    this.alive = true;
  }

  killPlayer(){
    this.alive = false;
  }

  revivePlayer(){
    this.alive = true;
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

  setDuelId(duelId) {
    this.duelId = duelId;
  }

  //killplayer


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

  socket.on("ping", () => {
    // Emit a pong event in response to the ping
    socket.emit("pong");
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
        socket.emit("gameBusy", gameId);
        console.log("game is busy");
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
    const rooms = openRooms.filter((g) => !g.gameStarted);
    socket.broadcast.emit("newRoom", rooms);
    checkEmptyRooms();
  });

  socket.on("getPlayers", (gameId) => {
    const game = openRooms.find((g) => g.id === gameId);
    if (game) {
      console.log("players sent");
      socket.emit("players", game);
    }
  });

  /*
  socket.on("generateWalls", () => {
    console.log('generatewalls server')
    const walls = generateWalls();
    socket.emit("Walls", obstacles);
    socket.broadcast.emit("walls", obstacles);
  })*/

  socket.on("startGame", (room) => {
    const game = openRooms.find((g) => g.id === room.id);
    if (game) {
      console.log(game);
      game.gameStarted = true;

      postDuelDb(game.id, game.mode.id, game.map.id)
        .then((data) => {
          console.log("Duel posted successfully:", data);
          game.setDuelId(data.data.duel_id);
          socket.emit("duelId", data.data.duel_id);
          socket.broadcast.emit("duelId", data.data.duel_id);
        })
        .catch((error) => {
          console.error("Error:", error);
        });

      socket.emit("gameStarted", room.id);
      console.log("game started");
      socket.broadcast.emit("gameStarted", room.id);
    }

    //check gamemode and run needed logic
    socket.on("checkModeMap", (id) => {
      if (!game) {
        console.log("game is not defined");
      } else if(game.id === id){

        //checking maps
        console.log('gamemap id: ' + game.map.id)
        if (game.map.id === 1) {
          socket.emit("teleportFalse");
          socket.broadcast.emit("teleportFalse");
          console.log("MAP is normal");

        } else if (game.map.id === 2) {
          socket.emit("teleportFalse");
          socket.broadcast.emit("teleportFalse");
          console.log("MAP is walls")

          const obstacles = generateWalls();
          console.log(obstacles);
          socket.emit("wallsGenerated", obstacles);
          socket.broadcast.emit("wallsGenerated", obstacles);

        } else if (game.map.id === 3) {
          if (typeof obstacles !== 'undefined' && obstacles !== null) {
            obstacles.length = 0;
          }
          console.log("MAP is nowalls");
          socket.emit("teleportTrue");
          socket.broadcast.emit("teleportTrue");
        }

        //checking modes
        if (game.mode.id === 1) {
          console.log("MODE is normal");
        } else if (game.mode.id === 2) {
          console.log("MODE is power-ups");
          socket.emit("generatePowerUps");
          socket.broadcast.emit("generatePowerUps");
        } else if (game.mode.id === 3) {
          console.log("MODE is limited-time");
          socket.emit("setTimeLimit");
          socket.broadcast.emit("setTimeLimit");
        }
      } else{
        console.log('game id does not match')
      }
    });
  });

  socket.on("getPlayerData", () => {
    // console.log(test);
    socket.emit("getData", snake,);
    socket.broadcast.emit("getData", snake);
  });

  socket.on("sendPlayerData", (snakeData, playerId) => {
    //console.log(playerId + "sent data");
    snake = { data: snakeData, id: playerId };
    // socket.emit('sendData');
    // socket.broadcast.emit('sendData');
  });

  socket.on("generateFood", (foodX, foodY) => {

    socket.emit("showFood", foodX, foodY);
    socket.broadcast.emit("showFood", foodX, foodY);
  });

  socket.on("generatePowerUp", (powerX, powerY) => {
    let random = Math.floor(Math.random() * 4 + 1);
    //testwaarde
    // const random = 4;
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

  socket.on("activateInvis", (playerId) => {
    socket.emit("activateInvis", playerId);
    socket.broadcast.emit("activateInvis", playerId);
  });

  socket.on("deactivateInvis", (playerId) => {
    socket.emit("deactivateInvis", playerId);
    socket.broadcast.emit("deactivateInvis", playerId);
  });

  socket.on("getRooms", () => {
    //send the rooms where game has not started and there are less than 4 players in the room
    const rooms = openRooms.filter((g) => !g.gameStarted);
    const r = rooms.filter((g) => g.players.length < 4);
    socket.emit("rooms", r);
  });

  socket.on("checkPlayerCount", (gameId) => {
    const game = openRooms.find((g) => g.id === gameId);
    if (game) {
      if (game.players.length >= 4) {
        socket.emit("roomFull", game.id);
      } else {
        socket.emit("roomNotFull", game.id);
      }
    }
  });

  socket.on("settingsChanged", (r) => {
    // update the room settings
    const game = openRooms.find((g) => g.id === r.id);
    if (game) {
      game.mode = r.mode;
      game.map = r.map;
      game.players = r.players;
    }
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
      checkEmptyRooms();
    }
  });

  function removePlayer(player) {
    const gameId = player.getGameId();
    console.log(gameId);
    const game = openRooms.find((g) => g.id === gameId);
    if (game) {
      game.removePlayer(player);
      if (player.creator) {
        console.log("creator left");
        console.log(game.players);
        console.log(game.players[0]);
        if (game.players.length > 0) {
          const playerId = game.players[0].socketId;
          const pl = players.find((p) => p.socketId === playerId);
          pl.setCreator();
          socket.emit("newCreator", pl.socketId);
          socket.broadcast.emit("newCreator", pl.socketId);
        } else {
          openRooms = openRooms.filter((g) => g.id !== game.id);
          socket.emit("evacuateRoom", game.id);
        }
      }
      socket.emit("playerLeft", game);
      socket.broadcast.emit("playerLeft", game);
      if (game.players.length === 0) {
        openRooms = openRooms.filter((g) => g.id !== game.id);
      }
    }
  }

  socket.on("leaveGameInProgress", (gameId) => {
    const game = openRooms.find((g) => g.id === gameId);
    if (game) {
      game.players.forEach((player) => {
        players = players.filter((p) => p.id !== player.id);
      });
      openRooms = openRooms.filter((g) => g.id !== game.id);
      const rooms = openRooms.filter((g) => !g.gameStarted);
      socket.emit("newRoom", rooms);
      socket.broadcast.emit("newRoom", rooms);
    }
  });

  socket.on("checkStatus", (gameId) => {
    const game = openRooms.find((g) => g.id === gameId);
    if (game) {
      console.log("game status checked");
      console.log(game);
      if (game.gameStarted) {
        socket.emit("gameBusy", gameId, socket.id);
      }
    }
  });

  socket.on("prepNewRoom", (roomId, sId) => {
    //remove all the players in the room from the players array
    const game = openRooms.find((g) => g.id === roomId);
    console.log(game);
    if (game) {
      console.log("game found");
      game.players.forEach((player) => {
        players = players.filter((p) => p.id !== player.id);
      });
      openRooms = openRooms.filter((g) => g.id !== roomId);
      console.log("Got here");
      const rooms = openRooms.filter((g) => !g.gameStarted);
      socket.emit("newRoom", rooms);
      socket.broadcast.emit("newRoom", rooms);
    }
    socket.emit("prepNewRoom", sId);
  });

  socket.on("evacuateOthers", (roomId) => {
    socket.broadcast.emit("evacuateRoom", roomId);
  });

  socket.on("checkIfRoomExists", (roomId) => {
    console.log("checking if room exists");
    console.log(roomId);
    const game = openRooms.find((g) => g.id === roomId);
    if (game) {
      socket.emit("roomExists", roomId);
      socket.broadcast.emit("roomExists", roomId);
    } else {
      socket.emit("roomDoesNotExist", roomId);
      socket.broadcast.emit("roomExists", roomId);
    }
  });

  socket.on("nextGameUrl", (gameId, newGameId) => {
    console.log("next game url", newGameId);
    console.log("next game url", newGameId);
    socket.emit("nextGameUrl", gameId, newGameId);
    socket.broadcast.emit("nextGameUrl", gameId, newGameId);
  });

  socket.on("gameOver", (gameId) => {
    console.log("game over in GameOver");
    const game = openRooms.find((g) => g.id === gameId);
    if (game) {
      game.gameStarted = false;
      patchDuelDb(game.duelId)
        .then((data) => {
          console.log("Duel patched successfully:", data);
        })
        .catch((error) => {
          console.error("Error:", error);
        });

      setTimeout(() => {
        socket.emit("gameOver", game.id);
        socket.broadcast.emit("gameOver", game.id);
        game.players.forEach((player) => {
          players = players.filter((p) => p.id !== player.id);
        });
        openRooms = openRooms.filter((g) => g.id !== game.id);
        const rooms = openRooms.filter((g) => !g.gameStarted);
        socket.emit("newRoom", rooms);
      }, 5000);
    }
  });

/*
  socket.on("playerDied", (playerId, gameId) => {
   console.log('inside playerDied: ' + playerId + ' ; gameid: ' + gameId)
   console.log('')
   
    const player = players.find((p) => p.id === playerId);
    if (player) {
      console.log('inside killplayer')
      player.alive = false;
      //make player alive false globally
      //use killplayer
      player.killPlayer();
      console.log(player)
    }

    checkAlivePlayers(gameId)

    console.log('emitting player died')

    socket.emit("playerDied", playerId);
    socket.broadcast.emit("playerDied", playerId);
  }
  );
});*/

socket.on("playerDied", (playerId, gameId) => {
  console.log('Player died event received for player: ' + playerId + ' in game: ' + gameId);
  // Find the player in the global players array
  const player = players.find((p) => p.id === playerId);
  if (player) {
    // Update the player's alive status directly in the global array
    player.alive = false;
    //console.log('Updated player status to dead:', player);
  } else {
    console.log('Player not found:', playerId);
  }

  // Update the player's status in the game
  const game = openRooms.find((g) => g.id === gameId);
  if (game) {
    const gamePlayer = game.players.find((p) => p.id === playerId);
    if (gamePlayer) {
      gamePlayer.alive = false;
      console.log('Updated game player status to dead:', gamePlayer);
    }
  }

  
  console.log('Emitting playerDied event to all clients');
  console.log('playerid: ' + playerId)
  
  socket.emit("someoneDied", playerId);
  socket.broadcast.emit("someoneDied", playerId);
  
  checkAlivePlayers(gameId);
});

socket.on('resetPlayersAlive', (id) => {
  console.log('Resetting players alive status for game: ' + id);
  const game = openRooms.find((g) => g.id === id);
  if (game) {
    game.players.forEach((p) => {
      p.alive = true;
      });
      console.log('Players alive status reset for game:', game);
    }
})


function checkAlivePlayers(gameId) {
  const game = openRooms.find((g) => g.id === gameId);

  if (game) {

    const alivePlayers = game.players.filter((player) => player.alive);
    const deadPlayers = game.players.filter((player) => !player.alive);

    console.log('inside checkaliveplayers')
    //console.log(game.players)
    
    //console.log(players)
    console.log(`Alive players: ${alivePlayers.length}`);
    console.log(`Dead players: ${deadPlayers.length}`);
    
    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0];
      console.log(`Player ${winner.id} is the winner!`);
      socket.emit("endGame", winner.name, gameId);
      socket.broadcast.emit("endGame", winner.name, gameId);
      //io.to(game.id).emit("endGame", winner.name);
      game.players.forEach((player) => {
        players = players.filter((p) => p.id !== player.id);
      });
      openRooms = openRooms.filter((g) => g.id !== game.id);
      io.to(game.id).emit("newRoom", openRooms);
    } else if (alivePlayers.length === 0) {
      console.log("No players alive, game over!");
      //io.to(game.id).emit("gameOverNoWinner", game.id);
      socket.emit("gameOverNoWinner", game.id);
      socket.broadcast.emit("gameOverNoWinner", game.id);
      game.players.forEach((player) => {
        players = players.filter((p) => p.id !== player.id);
      });
      openRooms = openRooms.filter((g) => g.id !== game.id);
      io.to(game.id).emit("newRoom", openRooms);
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
async function postDuelDb(duel_id, gamemode, map) {
  const url = `${process.env.API_BASE_URL}/api/duels`;

  const body = {
    duel_id: duel_id,
    gamemodes_id: gamemode,
    maps_id: map,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error posting duel:", error);
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

/* patch a duel (end time) when game ends */
// -> patch .../api/duels
async function patchDuelDb(duel_id) {
  const url = `${process.env.API_BASE_URL}/api/duels`;

  const body = {
    duel_id: duel_id,
  };

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error patching duel:", error);
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

//server side wall generation

function generateWalls() {
  // Add some obstacles
  const obstacles = [];
  const numObstacles = Math.max(15, Math.floor(Math.random() * 6) + 1); // Random number of obstacles between 1 and 6, but at least 15
  for (let i = 0; i < numObstacles; i++) {
    //voorlopig 20 niet krijgen van de client kan aangepast worden
    const obstacleX = Math.floor(Math.random() * 18) + 1;
    const obstacleY = Math.floor(Math.random() * 18) + 1;
    obstacles.push({ x: obstacleX, y: obstacleY });
  }
  return obstacles;
}
