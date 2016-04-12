document.addEventListener("DOMContentLoaded", function () {
  // Wait till the browser is ready to render the game (avoids glitches)
  window.requestAnimationFrame(function () {
    manager = new GameManager(6, InputManager, HTMLActuator);
  });
});

function GameManager(size, InputManager, Actuator) {
  this.size         = size; // Size of the grid
  this.inputManager = new InputManager;
  this.actuator     = new Actuator;
  this.grid         = new Grid(this.size);

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.actuator.restart();
  this.setup();
};

// Set up the game
GameManager.prototype.setup = function () {
  this.grid         = new Grid(this.size);

  this.score        = 0;
  this.over         = false;
  this.won          = false;

  this.addStartTiles();

  // Update the actuator
  this.actuate();
};

GameManager.prototype.addStartTiles = function() {
  var grid = this.grid;
  this.grid.eachCell(function(x, y, tile) {
  	var main_color,color;
  	if(y <=2 ) { main_color = 'red'; }
  	else { main_color = 'black'; }

    if( y<=2 && x<=2 ) { color = 'white'}
    else if( y>2 && x>2) {color = 'white'}
    else { color = main_color;}
    grid.insertTile(new Tile({x: x, y:y}, color));

  })
}

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  this.actuator.actuate(this.grid, {
    score: this.score,
    over:  this.over,
    won:   this.won,
  });
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid as specified
GameManager.prototype.move = function (move) {
  var self = this;

  if (this.over || this.won) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(move.dir);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();


  var orig_cell, orig_tile, final_cell;
  if(move.dir==='up' || move.dir==='down') {
  	var x = move.index;
    orig_cell = {x: x, y: traversals.y[0]};
    orig_tile = self.grid.cellContent(orig_cell);
    final_cell = {x: x, y: traversals.y[traversals.y.length -1]};
  	traversals.y.forEach(function(y) {
  	  self.moveRow(x, y, vector)
  	});
  } else {
  	var y = move.index;
    orig_cell = {x: traversals.x[0], y: y};
    orig_tile = self.grid.cellContent(orig_cell);
    final_cell = {x: traversals.x[traversals.x.length -1], y: y};
  	traversals.x.forEach(function(x) {
  	  self.moveRow(x, y, vector);
  	});
  }
  orig_tile.updatePosition(final_cell);
  this.grid.insertTile(orig_tile);
  this.actuate();
  this.checkCaptures();

  if(this.score >= 4) {
  	this.won = true;
  } else if (this.score <= -4) {
  	this.over = true;
  }

  this.actuate();

};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    'up': { x: 0,  y: -1 }, // up
    'right': { x: 1,  y: 0 },  // right
    'down': { x: 0,  y: 1 },  // down
    'left': { x: -1, y: 0 }   // left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.moveRow = function(x, y, vector) {
  var cell = { x: x, y: y };
  var tile = this.grid.cellContent(cell);
  var new_cell = { x: cell.x + vector.x, y: cell.y + vector.y};
  //if it should scroll, this is the first one, and will be dealt with later
  if((new_cell.y < 0 || new_cell.y >= this.size) || 
  	 (new_cell.x < 0 || new_cell.x >= this.size)) {
    
  } else {
    this.moveTile(tile, new_cell);    
  }
};

GameManager.prototype.checkCaptures = function() {
	var manager = this;
	this.grid.eachCell(function(x, y, tile) {
		//a tile is captured if
		//1) all surounding tiles are of a player color that is not the current color
		//2) two adjacent tiles are surrounded by a player color that is not the current color
		//var current_tile = tile.value;
		var directions = ['up', 'down', 'left', 'right'];
		var blacks = 0;
		var reds = 0;
		var blocked_by = [];
		var searchedAdjacent = false;
		directions.forEach(function(dir){
			var vec = manager.getVector(dir);
			var cell = {x: (x+vec.x + 6)%6, y:(y+vec.y + 6)%6};
			var compare_tile = manager.grid.cellContent(cell);
			//if it can capture
			if(compare_tile.value == 'red' || compare_tile.value=='black') {
				if(compare_tile.value != tile.value) {
					blocked_by.push(compare_tile.value);
					if(compare_tile.value == 'red') reds++;
					if(compare_tile.value == 'black') blacks++;
					return;
				}
			}
			blocked_by.push(null);
		});
		// if we find 3, look back at the odd one out and see if it is surrounded by same.
		if(reds == 3) {
			var index = blocked_by.findIndex(function(value) { return value != 'red'; });
			var direction = directions[index];
			var vec = manager.getVector(direction);
			var cell = {x: (x+vec.x + 6)%6, y:(y+vec.y + 6)%6};
			var compare_tile = manager.grid.cellContent(cell);
			if(manager.checkAdjacentCapture(compare_tile, direction, 'red')) {
				reds ++;
			}
		} else if(blacks == 3) {
			var index = blocked_by.findIndex(function(value) { return value != 'black'; });
			var direction = directions[index];
			var vec = manager.getVector(direction);
			var cell = {x: (x+vec.x + 6)%6, y:(y+vec.y + 6)%6};
			var compare_tile = manager.grid.cellContent(cell);
			if(manager.checkAdjacentCapture(compare_tile, direction, 'black')) {
				blacks ++;
			}
		}
		// if we find we are competly surrounded, a piece is captured.
		if(reds == 4) {
			if(tile.value == 'white') {
				manager.score -=1;
			} else {
				manager.score -=2;
			}
			tile.value = 'red';
			return;
		} else if(blacks == 4) {
			if(tile.value == 'white') {
				manager.score +=1;
			} else {
				manager.score +=2;
			}
			tile.value = 'black';
			return;
		}
		
	});
};

GameManager.prototype.checkAdjacentCapture = function(tile, direction, color) {
	var directions = ['up', 'down', 'left', 'right'];
	var matches = 0;
	directions.forEach(function(dir){
		if(dir === manager.getOppositeDir(direction)) return;
		var vec = manager.getVector(dir);
		var cell = {x: (tile.x+vec.x + 6)%6, y:(tile.y+vec.y + 6)%6};
		var compare_tile = manager.grid.cellContent(cell);
		//if it can capture
		if(compare_tile.value == color) {
			matches ++;
		}
	});
	if(matches == 3) {
		return true;
	}
	return false;
};

GameManager.prototype.getOppositeDir = function(dir) {
	if(dir === 'up') return 'down';
	if(dir === 'down') return 'up';
	if(dir === 'left') return 'right';
	if(dir === 'right') return 'left';
};

function Grid(size) {
  this.size = size;

  this.cells = [];

  this.build();
}

// Build a grid of the specified size
Grid.prototype.build = function () {
  for (var x = 0; x < this.size; x++) {
    var row = this.cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(null);
    }
  }
};

// Call callback for every cell
Grid.prototype.eachCell = function (callback) {
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      callback(x, y, this.cells[x][y]);
    }
  }
};

// Inserts a tile at its position
Grid.prototype.insertTile = function (tile) {
  this.cells[tile.x][tile.y] = tile;
};

Grid.prototype.removeTile = function (tile) {
  this.cells[tile.x][tile.y] = null;
};

Grid.prototype.cellContent = function (cell) {
  if (this.withinBounds(cell)) {
    return this.cells[cell.x][cell.y];
  } else {
    return null;
  }
};

Grid.prototype.withinBounds = function (position) {
  return position.x >= 0 && position.x < this.size &&
         position.y >= 0 && position.y < this.size;
};

function HTMLActuator() {
  this.tileContainer    = document.getElementsByClassName("tile-container")[0];
  this.scoreContainer   = document.getElementsByClassName("score-container")[0];
  this.messageContainer = document.getElementsByClassName("game-message")[0];

  this.score = 0;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell);
        }
      });
    });

    self.updateScore(metadata.score);

    if (metadata.over) self.message(false); // You lose
    if (metadata.won) self.message(true); // You win!
    if (!metadata.won && !metadata.over) self.clearMessage(); //neither
  });
};

HTMLActuator.prototype.restart = function () {
  this.clearMessage();
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

HTMLActuator.prototype.addTile = function (tile) {
  var self = this;

  var element   = document.createElement("div");
  var position  = tile.previousPosition || { x: tile.x, y: tile.y };
  positionClass = this.positionClass(position);

  // We can't use classlist because it somehow glitches when replacing classes
  var classes = ["tile", "tile-" + tile.value, positionClass];
  this.applyClasses(element, classes);

  //element.textContent = tile.value;

  if (tile.previousPosition) {
    // Make sure that the tile gets rendered in the previous position first
    window.requestAnimationFrame(function () {
      classes[2] = self.positionClass({ x: tile.x, y: tile.y });
      self.applyClasses(element, classes); // Update the position
    });
  } else {
    classes.push("tile-new");
    this.applyClasses(element, classes);
  }

  // Put the tile on the board
  this.tileContainer.appendChild(element);
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
  element.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.updateScore = function (score) {
  this.clearContainer(this.scoreContainer);

  var difference = score - this.score;
  this.score = score;

  this.scoreContainer.textContent = this.score;

  /*if (difference > 0) {
    var addition = document.createElement("div");
    addition.classList.add("score-addition");
    addition.textContent = "+" + difference;

    this.scoreContainer.appendChild(addition);
  }*/
};

HTMLActuator.prototype.message = function (won) {
  var type    = won ? "game-won" : "game-over";
  var message = won ? "You win!" : "You Loose"

  // if (ga) ga("send", "event", "game", "end", type, this.score);

  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
  this.messageContainer.classList.remove("game-won", "game-over");
};

function InputManager() {
  this.events = {};

  this.listen();
}

InputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

InputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

InputManager.prototype.move = function(direction, index) {
  this.emit("move", {dir: direction, index: index});
}

InputManager.prototype.listen = function () {
  var self = this;

  /*var map = {
    38: 0, // Up
    39: 1, // Right
    40: 2, // Down
    37: 3, // Left
    75: 0, // vim keybindings
    76: 1,
    74: 2,
    72: 3
  };

  document.addEventListener("keydown", function (event) {
    var modifiers = event.altKey || event.ctrlKey || event.metaKey ||
                    event.shiftKey;
    var mapped    = map[event.which];

    if (!modifiers) {
      if (mapped !== undefined) {
        event.preventDefault();
        self.emit("move", mapped);
      }

      if (event.which === 32) self.restart.bind(self)(event);
    }
  });*/

  var retry = document.getElementsByClassName("retry-button")[0];
  retry.addEventListener("click", this.restart.bind(this));

  /*// Listen to swipe events
  var gestures = [Hammer.DIRECTION_UP, Hammer.DIRECTION_RIGHT,
                  Hammer.DIRECTION_DOWN, Hammer.DIRECTION_LEFT];

  var gameContainer = document.getElementsByClassName("game-container")[0];
  var handler       = Hammer(gameContainer, {
    drag_block_horizontal: true,
    drag_block_vertical: true
  });
  
  handler.on("swipe", function (event) {
    event.gesture.preventDefault();
    mapped = gestures.indexOf(event.gesture.direction);

    if (mapped !== -1) self.emit("move", mapped);
  });*/
};

InputManager.prototype.restart = function (event) {
  event.preventDefault();
  this.emit("restart");
};

function Tile(position, value) {
  this.x                = position.x;
  this.y                = position.y;
  this.value            = value || 'white';
  this.previousPosition = null;
}

Tile.prototype.savePosition = function () {
  this.previousPosition = { x: this.x, y: this.y };
};

Tile.prototype.updatePosition = function (position) {
  this.x = position.x;
  this.y = position.y;
};
