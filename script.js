const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const currentScoreDisplay = document.getElementById("current-score");
const highScoreDisplay = document.getElementById("high-score-display");
const dPad = document.getElementById("d-pad");

let snake = [{x: 10, y: 10}], food = {x: 5, y: 5}, dx = 0, dy = -1, score = 0;
let highScore = localStorage.getItem("pirateHighScore") || 0;
highScoreDisplay.textContent = highScore;

startBtn.addEventListener("click", startGame);

function startGame() {
    startScreen.style.display = "none";
    canvas.style.display = "block";
    dPad.style.display = "flex";
    score = 0;
    snake = [{x: 10, y: 10}];
    dx = 0; dy = -1;
    gameLoop = setInterval(update, 100);
}

function update() {
    const head = {x: snake[0].x + dx, y: snake[0].y + dy};
    if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || snake.some(p => p.x === head.x && p.y === head.y)) return endGame();
    
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        currentScoreDisplay.textContent = score;
        food = {x: Math.floor(Math.random()*20), y: Math.floor(Math.random()*20)};
    } else { snake.pop(); }
    
    draw();
}

function draw() {
    ctx.fillStyle = "#1a1208";
    ctx.fillRect(0, 0, 400, 400);
    ctx.fillStyle = "#d4af37";
    snake.forEach(p => ctx.fillRect(p.x*20, p.y*20, 18, 18));
    ctx.font = "20px Arial";
    ctx.fillText("🪙", food.x*20, food.y*20+18);
}

function endGame() {
    clearInterval(gameLoop);
    if (score > highScore) { highScore = score; localStorage.setItem("pirateHighScore", highScore); }
    startScreen.style.display = "block";
    startBtn.textContent = "PLAY AGAIN";
}

// Controls
document.getElementById("btn-up").addEventListener("touchstart", () => { if(dy !== 1) { dx = 0; dy = -1; }});
document.getElementById("btn-down").addEventListener("touchstart", () => { if(dy !== -1) { dx = 0; dy = 1; }});
document.getElementById("btn-left").addEventListener("touchstart", () => { if(dx !== 1) { dx = -1; dy = 0; }});
document.getElementById("btn-right").addEventListener("touchstart", () => { if(dx !== 1) { dx = 1; dy = 0; }});