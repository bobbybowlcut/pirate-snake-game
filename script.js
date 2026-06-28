"use strict";

/* =========================
   FIREBASE IMPORTS
========================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   FIREBASE CONFIG
========================= */

const firebaseConfig = {
    apiKey: "AIzaSyBsc7kIz7woCLCl-0xk76CjUsX8cmstyFM",
    authDomain: "pirate-snake.firebaseapp.com",
    projectId: "pirate-snake",
    storageBucket: "pirate-snake.firebasestorage.app",
    messagingSenderId: "786570946514",
    appId: "1:786570946514:web:1c190f9b7bf27f73b18a0b",
    measurementId: "G-CR21XZGM55"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
   APP STATE
========================= */

let currentUser = localStorage.getItem("pirateSnakeUser") || "";

let snake = [];
let food = { x: 0, y: 0 };

let direction = { x: 1, y: 0 };
let queuedDirection = { x: 1, y: 0 };

let score = 0;

let gameLoopId = null;
let gameActive = false;
let gameEnded = false;

let liveMessages = [];
let liveLeaderboardScores = [];

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
    listenForMessages();
    listenForLeaderboard();

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
   MESSAGE BOARD - FIRESTORE
========================= */

function getMessageCutoffTimestamp() {
    const cutoffMs = Date.now() - MESSAGE_LIFETIME_MS;
    return Timestamp.fromMillis(cutoffMs);
}

async function deleteExpiredMessages() {
    const cutoff = getMessageCutoffTimestamp();

    const expiredMessagesQuery = query(
        collection(db, "messages"),
        where("createdAt", "<", cutoff)
    );

    const snapshot = await getDocs(expiredMessagesQuery);

    snapshot.forEach(async documentSnapshot => {
        await deleteDoc(doc(db, "messages", documentSnapshot.id));
    });
}

function listenForMessages() {
    const cutoff = getMessageCutoffTimestamp();

    const messagesQuery = query(
        collection(db, "messages"),
        where("createdAt", ">=", cutoff),
        orderBy("createdAt", "asc"),
        limit(MAX_MESSAGES)
    );

    onSnapshot(messagesQuery, snapshot => {
        liveMessages = [];

        snapshot.forEach(documentSnapshot => {
            liveMessages.push({
                id: documentSnapshot.id,
                ...documentSnapshot.data()
            });
        });

        renderMessages();
    });
}

function renderMessages() {
    messagesContainer.innerHTML = "";

    if (liveMessages.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "message";
        emptyMessage.textContent = "No messages yet.";
        messagesContainer.appendChild(emptyMessage);
        return;
    }

    liveMessages.forEach(message => {
        const row = document.createElement("div");
        row.className = "message";

        const username = document.createElement("span");
        username.className = "username";
        username.textContent = message.user || "Guest";

        const messageText = document.createElement("span");
        messageText.textContent = `: ${message.text || ""}`;

        row.appendChild(username);
        row.appendChild(messageText);

        messagesContainer.appendChild(row);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function postMessage() {
    const text = newMessageInput.value.trim();

    if (!text) return;

    await addDoc(collection(db, "messages"), {
        user: currentUser || "Guest",
        text,
        createdAt: serverTimestamp()
    });

    newMessageInput.value = "";
}

openBoardBtn.addEventListener("click", async () => {
    stopGame();
    await deleteExpiredMessages();
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
   LEADERBOARD - FIRESTORE
========================= */

function listenForLeaderboard() {
    const leaderboardQuery = query(
        collection(db, "leaderboard"),
        orderBy("score", "desc"),
        limit(MAX_LEADERBOARD_SCORES)
    );

    onSnapshot(leaderboardQuery, snapshot => {
        liveLeaderboardScores = [];

        snapshot.forEach(documentSnapshot => {
            liveLeaderboardScores.push({
                id: documentSnapshot.id,
                ...documentSnapshot.data()
            });
        });

        renderLeaderboard();
    });
}

async function scoreQualifiesForLeaderboard(newScore) {
    if (newScore <= 0) return false;

    const leaderboardQuery = query(
        collection(db, "leaderboard"),
        orderBy("score", "desc"),
        limit(MAX_LEADERBOARD_SCORES)
    );

    const snapshot = await getDocs(leaderboardQuery);

    const scores = [];

    snapshot.forEach(documentSnapshot => {
        scores.push(documentSnapshot.data());
    });

    if (scores.length < MAX_LEADERBOARD_SCORES) {
        return true;
    }

    const lowestTopScore = scores[scores.length - 1]?.score || 0;

    return newScore > lowestTopScore;
}

async function saveScoreIfHighEnough() {
    const qualifies = await scoreQualifiesForLeaderboard(score);

    if (!qualifies) return;

    await addDoc(collection(db, "leaderboard"), {
        user: currentUser || "Guest",
        score,
        createdAt: serverTimestamp()
    });
}

function renderLeaderboard() {
    leaderboardList.innerHTML = "";

    if (liveLeaderboardScores.length === 0) {
        const emptyScore = document.createElement("li");
        emptyScore.textContent = "No scores yet.";
        leaderboardList.appendChild(emptyScore);
        return;
    }

    liveLeaderboardScores.forEach(entry => {
        const item = document.createElement("li");
        item.textContent = `${entry.user || "Guest"} - ${entry.score || 0}`;
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

async function endGame() {
    if (gameEnded) return;

    gameEnded = true;
    gameActive = false;

    if (gameLoopId !== null) {
        clearTimeout(gameLoopId);
        gameLoopId = null;
    }

    finalScore.textContent = score;
    showScreen("game-over-screen");

    await saveScoreIfHighEnough();
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