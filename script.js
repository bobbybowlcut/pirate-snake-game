"use strict";

/* =========================
   CONFIG
========================= */

const GRID_SIZE = 20;
const TILE_COUNT = 20;
const CANVAS_SIZE = GRID_SIZE * TILE_COUNT;

const GAME_SPEED_MS = 115;
const MESSAGE_LIFETIME_MS = 72 * 60 * 60 * 1000;
const MAX_MESSAGES = 75;
const MAX_LEADERBOARD_SCORES = 10;

/* =========================
   DOM ELEMENTS
========================= */

const screens = document.querySelectorAll(".app-screen");

const usernameInput = document.getElementById("username-input");
const saveUserBtn = document.getElementById("save-user-btn");
const displayUsername = document.getElementById("display-username");

const startBtn = document.getElementById("start-btn");
const openBoardBtn = document.getElementById("open-board-btn");
const openLeaderboardBtn = document.getElementById("open-leaderboard-btn");

const messagesContainer = document.getElementById("messages-container");
const newMessageInput = document.getElementById("new-message-input");
const postMessageBtn = document.getElementById("post-message-btn");
const closeBoardBtn = document.getElementById("close-board-btn");

const leaderboardList = document.getElementById("leaderboard-list");
const closeLeaderboardBtn = document.getElementById("close-leaderboard-btn");

const scoreDisplay = document.getElementById("score-display");
const finalScore = document.getElementById("final-score");
const tryAgainBtn = document.getElementById("try-again-btn");
const goMenuBtn = document.getElementById("go-menu-btn");

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

/* =========================
   SAFE STORAGE HELPERS
========================= */

function readJSON(key, fallbackValue) {
    try {
        const storedValue = localStorage.getItem(key);
        return storedValue ? JSON.parse(storedValue) : fallbackValue;
    } catch (error) {
        console.warn(`Unable to read ${key} from localStorage.`, error);
        return fallbackValue;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`Unable to write ${key} to localStorage.`, error);
    }
}

/* =========================
   APP STATE
========================= */

let currentUser = localStorage.getItem("pirateSnakeUser") || "";

let messages = readJSON("pirateSnakeMessages", []);
let leaderboardScores = readJSON("pirateSnakeScores", []);

let snake = [];
let food = { x: 0, y: 0 };

let direction = { x: 1, y: 0 };
let queuedDirection = { x: 1, y: 0 };

let score = 0;

let gameLoopId = null;
let gameActive = false;
let gameEnded = false;

/* =========================
   IMAGE
========================= */

const oceanImage = new Image();
oceanImage.src = "ocean.png";

/* =========================
   SCREEN MANAGEMENT
========================= */

function showScreen(screenId) {
    screens.forEach(screen => {
        screen.classList.add("hidden");
    });

    const nextScreen = document.getElementById(screenId);

    if (nextScreen) {
        nextScreen.classList.remove("hidden");
    }
}

function showMenu() {
    stopGame();

    displayUsername.textContent = currentUser;
    showScreen("menu-screen");
}

/* =========================
   INIT
========================= */

function initApp() {
    stopGame();

    if (currentUser.trim()) {
        showMenu();
    } else {
        showScreen("register-screen");
    }
}

document.addEventListener("DOMContentLoaded", initApp);

/* =========================
   USERNAME
========================= */

function saveUsername() {
    const name = usernameInput.value.trim();

    if (name.length < 2) {
        alert("Please enter a pirate name with at least 2 characters.");
        return;
    }

    currentUser = name;
    localStorage.setItem("pirateSnakeUser", currentUser);

    showMenu();
}

saveUserBtn.addEventListener("click", saveUsername);

usernameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        saveUsername();
    }
});

/* =========================
   MESSAGE BOARD
========================= */

function pruneOldMessages() {
    const now = Date.now();

    messages = messages
        .filter(message => now - message.time < MESSAGE_LIFETIME_MS)
        .slice(-MAX_MESSAGES);

    writeJSON("pirateSnakeMessages", messages);
}

function renderMessages() {
    pruneOldMessages();

    messagesContainer.innerHTML = "";

    if (messages.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "message";
        emptyMessage.textContent = "No messages yet.";
        messagesContainer.appendChild(emptyMessage);
        return;
    }

    messages.forEach(message => {
        const row = document.createElement("div");
        row.className = "message";

        const username = document.createElement("span");
        username.className = "username";
        username.textContent = message.user;

        const messageText = document.createElement("span");
        messageText.textContent = `: ${message.text}`;

        row.appendChild(username);
        row.appendChild(messageText);

        messagesContainer.appendChild(row);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function postMessage() {
    const text = newMessageInput.value.trim();

    if (!text) return;

    messages.push({
        user: currentUser || "Guest",
        text,
        time: Date.now()
    });

    newMessageInput.value = "";

    pruneOldMessages();
    renderMessages();
}

openBoardBtn.addEventListener("click", () => {
    stopGame();
    renderMessages();
    showScreen("message-board-screen");
});

closeBoardBtn.addEventListener("click", showMenu);
postMessageBtn.addEventListener("click", postMessage);

newMessageInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        postMessage();
    }
});

/* =========================
   LEADERBOARD
========================= */

function scoreQualifiesForLeaderboard(newScore) {
    if (newScore <= 0) return false;

    if (leaderboardScores.length < MAX_LEADERBOARD_SCORES) {
        return true;
    }

    const lowestScore = leaderboardScores[leaderboardScores.length - 1]?.score || 0;
    return newScore > lowestScore;
}

function saveScoreIfHighEnough() {
    if (!scoreQualifiesForLeaderboard(score)) {
        return;
    }

    leaderboardScores.push({
        user: currentUser || "Guest",
        score,
        time: Date.now()
    });

    leaderboardScores.sort((a, b) => b.score - a.score);
    leaderboardScores = leaderboardScores.slice(0, MAX_LEADERBOARD_SCORES);

    writeJSON("pirateSnakeScores", leaderboardScores);
}

function renderLeaderboard() {
    leaderboardList.innerHTML = "";

    if (leaderboardScores.length === 0) {
        const emptyScore = document.createElement("li");
        emptyScore.textContent = "No scores yet.";
        leaderboardList.appendChild(emptyScore);
        return;
    }

    leaderboardScores.forEach(entry => {
        const item = document.createElement("li");
        item.textContent = `${entry.user} - ${entry.score}`;
        leaderboardList.appendChild(item);
    });
}

openLeaderboardBtn.addEventListener("click", () => {
    stopGame();
    renderLeaderboard();
    showScreen("leaderboard-screen");
});

closeLeaderboardBtn.addEventListener("click", showMenu);

/* =========================
   GAME LOOP CONTROL
========================= */

function startGame() {
    stopGame();
    resetGame();

    showScreen("game-screen");

    gameActive = true;
    gameEnded = false;

    scheduleNextTick();
}

function stopGame() {
    gameActive = false;

    if (gameLoopId !== null) {
        clearTimeout(gameLoopId);
        gameLoopId = null;
    }
}

function scheduleNextTick() {
    if (!gameActive || gameEnded) return;

    gameLoopId = setTimeout(() => {
        gameLoopId = null;
        gameTick();
    }, GAME_SPEED_MS);
}

function gameTick() {
    if (!gameActive || gameEnded) return;

    updateGame();

    if (!gameActive || gameEnded) return;

    renderGame();
    scheduleNextTick();
}

function endGame() {
    if (gameEnded) return;

    gameEnded = true;
    gameActive = false;

    if (gameLoopId !== null) {
        clearTimeout(gameLoopId);
        gameLoopId = null;
    }

    saveScoreIfHighEnough();

    finalScore.textContent = score;
    showScreen("game-over-screen");
}

/* =========================
   GAME STATE
========================= */

function resetGame() {
    snake = [{ x: 10, y: 10 }];

    direction = { x: 1, y: 0 };
    queuedDirection = { x: 1, y: 0 };

    score = 0;
    gameEnded = false;

    spawnFood();
    updateScoreDisplay();
    renderGame();
}

function spawnFood() {
    let newFood;

    do {
        newFood = {
            x: Math.floor(Math.random() * TILE_COUNT),
            y: Math.floor(Math.random() * TILE_COUNT)
        };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));

    food = newFood;
}

function updateGame() {
    direction = queuedDirection;

    const currentHead = snake[0];

    const newHead = {
        x: currentHead.x + direction.x,
        y: currentHead.y + direction.y
    };

    const hitWall =
        newHead.x < 0 ||
        newHead.x >= TILE_COUNT ||
        newHead.y < 0 ||
        newHead.y >= TILE_COUNT;

    if (hitWall) {
        endGame();
        return;
    }

    const willEatFood = newHead.x === food.x && newHead.y === food.y;

    /*
       If the snake is NOT eating, the tail moves away.
       So checking collision against the body without the tail prevents false self-collisions.
    */
    const bodyToCheck = willEatFood ? snake : snake.slice(0, -1);

    const hitSelf = bodyToCheck.some(segment => {
        return segment.x === newHead.x && segment.y === newHead.y;
    });

    if (hitSelf) {
        endGame();
        return;
    }

    snake.unshift(newHead);

    if (willEatFood) {
        score += 10;
        spawnFood();
        updateScoreDisplay();
    } else {
        snake.pop();
    }
}

function updateScoreDisplay() {
    scoreDisplay.textContent = `Score: ${score}`;
}

/* =========================
   RENDERING
========================= */

function renderGame() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    drawOceanBackground();
    drawGrid();
    drawFood();
    drawSnake();
}

function drawOceanBackground() {
    ctx.fillStyle = "#0b3d91";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (oceanImage.complete && oceanImage.naturalWidth > 0) {
        ctx.drawImage(oceanImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
}

function drawGrid() {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= TILE_COUNT; i++) {
        const position = i * GRID_SIZE;

        ctx.beginPath();
        ctx.moveTo(position, 0);
        ctx.lineTo(position, CANVAS_SIZE);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, position);
        ctx.lineTo(CANVAS_SIZE, position);
        ctx.stroke();
    }
}

function drawSnake() {
    snake.forEach((segment, index) => {
        const x = segment.x * GRID_SIZE;
        const y = segment.y * GRID_SIZE;

        ctx.fillStyle = index === 0 ? "#00ff66" : "#2ecc71";

        ctx.fillRect(
            x + 1,
            y + 1,
            GRID_SIZE - 2,
            GRID_SIZE - 2
        );
    });
}

function drawFood() {
    const centerX = food.x * GRID_SIZE + GRID_SIZE / 2;
    const centerY = food.y * GRID_SIZE + GRID_SIZE / 2;

    ctx.fillStyle = "#ffd700";

    ctx.beginPath();
    ctx.arc(centerX, centerY, GRID_SIZE / 2.7, 0, Math.PI * 2);
    ctx.fill();
}

/* =========================
   INPUT
========================= */

function setDirection(x, y) {
    if (!gameActive || gameEnded) return;

    const isReverse =
        x === -direction.x &&
        y === -direction.y;

    if (isReverse) return;

    queuedDirection = { x, y };
}

window.addEventListener("keydown", event => {
    if (event.key === "ArrowUp") setDirection(0, -1);
    if (event.key === "ArrowDown") setDirection(0, 1);
    if (event.key === "ArrowLeft") setDirection(-1, 0);
    if (event.key === "ArrowRight") setDirection(1, 0);
});

document.querySelectorAll(".d-btn").forEach(button => {
    button.addEventListener("click", () => {
        const selectedDirection = button.dataset.dir;

        if (selectedDirection === "up") setDirection(0, -1);
        if (selectedDirection === "down") setDirection(0, 1);
        if (selectedDirection === "left") setDirection(-1, 0);
        if (selectedDirection === "right") setDirection(1, 0);
    });
});

/* =========================
   BUTTON EVENTS
========================= */

startBtn.addEventListener("click", startGame);
tryAgainBtn.addEventListener("click", startGame);
goMenuBtn.addEventListener("click", showMenu);