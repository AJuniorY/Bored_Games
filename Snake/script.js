const canvas =
document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const tileSize = 20;
let snake = [{ x:200, y: 200 }];
let dx = tileSize; // moving right
let dy = 0;
let food = randomFood();
let gameOver = false;

document,addEventListener("keydown", changeDirection);
setInterval(gameLoop, 100);

//MAIN GAME LOOP
function gameLoop() {
    if (gameOver) return;

    moveSnake();
    if (checkCollision()); {
        alert("Game Over!");
        gameOver = true;
    }
    drawBoard();
    drawFood();
    drawSnake();
}

// Draw background
function drawBoard() {
    ctx.fillStyle = "#222";
    ctx.fillRect(0,0, canvas.clientWidth, canvas.height);
}

// Draw snake
function drawSnake() {
    ctx.fillStyle = "lime";

    snake.forEach(part => {
        ctx.fillRect(part.x, part.y, tileSize, tileSize);
    });
}

// Moving snake forward
function moveSnake() {
    const head = {
        x: snake[0].x + dx,
        y: snake[0].y + dy
    };

    snake.unshift(head);

    // When snake eats food
    if (head.x === food.x && head.y === food.y) {
        food = randomFood();
    } else {
        snake.pop();
    }
}

// Draw food
function drawFood() {
    ctx.fillStyle ="red";
    ctx.fillRect(food.x, food.y, tileSize, tileSize);
}

// Random food position
function randomFood() {
    return {
        x: Math.floor(Math.random() * 20) * tileSize,
        y: Math.floor(Math.random() * 20) * tileSize
    };
}

// Keyboard input
function changeDirection(e) {
    if (e.key === "ArrowUp" && dy === 0) {
        dx = 0;
        dy = -tileSize;
    }
    else if (e.key === "ArrowDown" && dy === 0) {
        dx = 0;
        dy = tileSize;
    }
    else if (e.key === "ArrowLeft" && dx === 0) {
        dx = -tileSize;
        dy = 0;
    }
    else if (e.key === "ArrowRight" && dx === 0) {
        dx = tileSize;
        dy = 0;
    }
}

// Detect collisions
function checkCollision() {
    const head = snake[0];

    // Wall collision
    if (
        head.x < 0 || head.x >= canvas.width ||
        head.y < 0 || head.y >= canvas.height
    ) return true;

    // Self collision
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) 
    return true;
    }
    return false;
}