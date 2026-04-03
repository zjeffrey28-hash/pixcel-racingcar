// 1. 初始化字节跳动小游戏环境
const canvas = tt.createCanvas();
const ctx = canvas.getContext('2d');
const { windowWidth, windowHeight } = tt.getSystemInfoSync();

// 2. 游戏核心状态
let state = {
    speed: 0,
    cruiseSpeed: 300,
    distance: 0, 
    shield: 100,
    score: 0,
    targetLane: 1,
    carX: windowWidth / 2,
    gameStarted: false,
    gameOver: false,
    obstacles: [],
    tick: 0,
    isBraking: false,
    lineOffset: 0 // 车道线滚动偏移
};

const CONFIG = {
    laneWidth: windowWidth / 4.5,
    accel: 0.15,
    brake: 3.0,
    hitDamage: 35,
    npcSpeed: 150
};

// 3. 触摸监听 (适配移动端)
tt.onTouchStart((res) => {
    const touch = res.touches[0];
    const x = touch.pageX;
    if (!state.gameStarted || state.gameOver) {
        resetGame();
        state.gameStarted = true;
        return;
    }
    if (x < windowWidth / 3) moveLane(-1);
    else if (x > (windowWidth * 2) / 3) moveLane(1);
    else state.isBraking = true;
});

tt.onTouchEnd(() => { state.isBraking = false; });

function moveLane(dir) {
    let n = state.targetLane + dir;
    if (n >= 0 && n <= 2) state.targetLane = n;
}

function resetGame() {
    state.speed = 0; state.distance = 0; state.score = 0; state.shield = 100;
    state.targetLane = 1; state.obstacles = []; state.gameOver = false;
}

function getLaneX(lane) {
    return (windowWidth / 2) + (lane - 1) * CONFIG.laneWidth;
}

// 4. 逻辑更新
function update() {
    if (!state.gameStarted || state.gameOver) return;

    state.tick++;
    
    // 1. 玩家速度逻辑 (保持不变)
    if (state.isBraking) {
        state.speed = Math.max(0, state.speed - CONFIG.brake);
    } else {
        if (state.speed < state.cruiseSpeed) state.speed += CONFIG.accel;
    }

    // 2. 马路滚动 (只受玩家速度影响)
    state.distance += state.speed / 60;
    state.lineOffset = (state.distance * 5) % 80; 

    // 3. 玩家左右平滑移动
    state.carX += (getLaneX(state.targetLane) - state.carX) * 0.2;

    // 4. 障碍车逻辑 (关键修复)
    state.obstacles.forEach(o => {
        // 让障碍车有一个基础向下的移动速度（模拟它在马路上往前开）
        // 逻辑：屏幕位移 = 玩家速度 - 障碍车自身速度
        // 如果 玩家 300，NPC 100，NPC 向下掉（被超车）
        // 如果 玩家 50，NPC 100，NPC 向上走（它在远离你）
        // 如果 玩家 0，NPC 100，NPC 飞速向上消失（它开走了，你停了）
        
        let relativeSpeed = (state.speed - o.speed) / 10; 
        o.y += relativeSpeed; 

        // 碰撞检测
        const py = windowHeight - 150;
        if (Math.abs(getLaneX(o.lane) - state.carX) < 30 && o.y > py - 50 && o.y < py + 50) {
            if (!o.hit) {
                o.hit = true;
                state.shield -= CONFIG.hitDamage;
                state.speed *= 0.4;
                if (state.shield <= 0) state.gameOver = true;
            }
        }
    });

    // 5. 生成新的障碍车时赋予随机速度
    if (state.tick % 80 === 0) {
        state.obstacles.push({
            lane: Math.floor(Math.random() * 3),
            y: -100, // 从顶部出现
            speed: 80 + Math.random() * 100, // 障碍车的时速 80-180
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            hit: false
        });
    }

    // 清理跑出屏幕太远的车辆（上下都要清理）
    state.obstacles = state.obstacles.filter(o => o.y < windowHeight + 200 && o.y > -500);
}

// 5. 渲染画面 (修复了车道线)
function draw() {
    // 渲染草地背景
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, windowWidth, windowHeight);

    // 渲染公路主体
    const roadWidth = CONFIG.laneWidth * 3.5;
    ctx.fillStyle = '#333';
    ctx.fillRect(windowWidth/2 - roadWidth/2, 0, roadWidth, windowHeight);

    // 渲染路肩 (白线)
    ctx.fillStyle = '#fff';
    ctx.fillRect(windowWidth/2 - roadWidth/2 - 5, 0, 5, windowHeight);
    ctx.fillRect(windowWidth/2 + roadWidth/2, 0, 5, windowHeight);

    // --- 核心修复：绘制动态车道虚线 ---
    ctx.save();
    ctx.setLineDash([40, 40]); // 设置虚线样式 [线段长度, 间距长度]
    ctx.lineDashOffset = -state.lineOffset; // 根据距离改变偏移，实现滚动
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;

    for (let i = 0; i < 2; i++) {
        const x = windowWidth/2 - CONFIG.laneWidth/2 + (i * CONFIG.laneWidth);
        ctx.beginPath();
        ctx.moveTo(x, -100);
        ctx.lineTo(x, windowHeight + 100);
        ctx.stroke();
    }
    ctx.restore();

    // 绘制障碍车
    state.obstacles.forEach(o => {
        drawPixelCar(getLaneX(o.lane), o.y, o.color);
    });

    // 绘制玩家
    drawPixelCar(state.carX, windowHeight - 150, '#ff4757', true);

    // 绘制 UI
    drawUI();

    if (!state.gameStarted) drawOverlay("点击屏幕启动引擎");
    if (state.gameOver) drawOverlay("游戏结束\n点击重赛");
}

function drawPixelCar(x, y, color, isPlayer = false) {
    ctx.fillStyle = '#1e1e1e'; // 阴影
    ctx.fillRect(x - 18, y - 28, 40, 60);
    ctx.fillStyle = color; // 车身
    ctx.fillRect(x - 20, y - 30, 40, 60);
    ctx.fillStyle = '#333'; // 车窗
    ctx.fillRect(x - 15, y - 15, 30, 15);
    
    if (isPlayer && state.isBraking) {
        ctx.fillStyle = '#ff0000'; // 刹车灯
        ctx.fillRect(x - 18, y + 25, 10, 4);
        ctx.fillRect(x + 8, y + 25, 10, 4);
    }
}

function drawUI() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`SCORE: ${Math.floor(state.distance)}`, 20, 50);
    ctx.fillText(`${Math.floor(state.speed)} KM/H`, 20, 80);
    
    // 血条背景
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(20, 100, 100, 12);
    // 血条
    ctx.fillStyle = state.shield > 35 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(20, 100, Math.max(0, state.shield), 12);
}

function drawOverlay(msg) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, windowWidth, windowHeight);
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    const lines = msg.split('\n');
    lines.forEach((line, i) => ctx.fillText(line, windowWidth / 2, windowHeight / 2 + i * 35));
    ctx.textAlign = 'left';
}

// 6. 启动循环
function mainLoop() {
    update();
    draw();
    requestAnimationFrame(mainLoop);
}
mainLoop();