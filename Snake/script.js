/* Main game logic separated into script.js */
(function(){
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  // UI
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const soundToggle = document.getElementById('soundToggle');
  const speedSel = document.getElementById('speedSel');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const movesEl = document.getElementById('moves');
  const lengthEl = document.getElementById('length');
  const wrapToggle = document.getElementById('wrapToggle');
  const obstaclesToggle = document.getElementById('obstaclesToggle');
  const scoreboardList = document.getElementById('scoreboardList');
  const clearScoresBtn = document.getElementById('clearScores');
  const modeEl = document.getElementById('mode');

  const touchButtons = document.querySelectorAll('.touch-controls button');

  // Game config
  const GRID = 20; // cells per side
  let cols = GRID, rows = GRID;
  let cellSize = 24;

  // Game state
  let snake = [];
  let dir = {x:1,y:0};
  let nextDir = null;
  let food = null; // {x,y,type,created,expires}
  let obstacles = [];
  let score = 0; let moves = 0;
  let tickRate = parseInt(speedSel.value,10);
  let running = false; let paused = false;
  let lastTime = 0; let accumulator = 0; let rafId = null;
  let highScore = parseInt(localStorage.getItem('snake_high')||'0',10) || 0;
  bestEl.textContent = highScore;
  let snd = true; let audioCtx = null;

  // Scoreboard (top 5)
  function loadScores(){
    try{return JSON.parse(localStorage.getItem('snake_scores')||'[]');}catch(e){return []}
  }
  function saveScores(list){ localStorage.setItem('snake_scores', JSON.stringify(list)); }
  function addScoreEntry(value, mode, speed, length){
    const list = loadScores();
    list.push({score:value, mode, speed, length, date: new Date().toISOString()});
    list.sort((a,b)=>b.score-a.score);
    const top = list.slice(0,5);
    saveScores(top);
    renderScoreboard();
  }
  function renderScoreboard(){
    const list = loadScores();
    scoreboardList.innerHTML = '';
    if(list.length === 0){ scoreboardList.innerHTML = '<li class="muted">No scores yet</li>'; return; }
    list.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.score} — ${item.mode} — ${item.speed} — ${new Date(item.date).toLocaleString()}`;
      scoreboardList.appendChild(li);
    });
  }
  clearScoresBtn.addEventListener('click', ()=>{ localStorage.removeItem('snake_scores'); renderScoreboard(); });

  // Appearance
  const backgroundColor = '#071426';
  const snakeHeadColor = '#10b981';
  const snakeBodyColorA = '#7c3aed';
  const snakeBodyColorB = '#3b82f6';
  const foodColor = '#f97316';
  const bonusFoodColor = '#f43f5e';
  const obstacleColor = '#111827';

  // Responsive canvas
  function resizeCanvas(){
    const container = canvas.parentElement; const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, window.innerHeight - rect.top - 40, 720);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(size * dpr); canvas.height = Math.floor(size * dpr);
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px'; ctx.setTransform(dpr,0,0,dpr,0,0);
    cellSize = size / GRID;
  }
  window.addEventListener('resize', resizeCanvas);

  // helpers
  function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function inSnake(x,y){ return snake.some(s=>s.x===x&&s.y===y); }
  function inObstacles(x,y){ return obstacles.some(o=>o.x===x&&o.y===y); }

  // Food management: ensure single food at a time; spawn delays and bonus expiry
  let foodCooldown = 200; // ms delay before respawn after eaten
  let lastFoodClearedAt = 0;
  function spawnFood(forceType=null){
    // if food exists, do not spawn
    if(food) return;
    // ensure cooldown
    const now = performance.now();
    if(now - lastFoodClearedAt < foodCooldown) return;

    // pick type: mostly normal, sometimes bonus
    const roll = Math.random();
    let type = 'normal';
    if(forceType) type = forceType;
    else if(roll > 0.92) type = 'bonus'; // ~8% chance

    // find empty cell
    const free = [];
    for(let x=0;x<cols;x++) for(let y=0;y<rows;y++){
      if(inSnake(x,y) || inObstacles(x,y)) continue; free.push({x,y});
    }
    if(free.length === 0) return; // board full
    const pick = free[randInt(0, free.length-1)];
    const created = performance.now();
    let expires = null;
    if(type === 'bonus') expires = created + 3000 + randInt(0,2200); // 3-5.2s
    food = { x: pick.x, y: pick.y, type, created, expires };
    lastFoodClearedAt = 0;
  }
  function clearFood(){ food = null; lastFoodClearedAt = performance.now(); }

  // obstacles
  function generateObstacles(count){ obstacles = []; const max = Math.min(count, Math.floor((cols*rows)/6)); let tries=0; while(obstacles.length < max && tries < 5000){ tries++; const x=randInt(1,cols-2); const y=randInt(1,rows-2); if(inSnake(x,y)) continue; if(inObstacles(x,y)) continue; if(food && food.x===x && food.y===y) continue; obstacles.push({x,y}); } }

  // reset
  function resetGame(){
    snake = [];
    const cx = Math.floor(cols/2); const cy = Math.floor(rows/2);
    snake = [{x:cx-1,y:cy},{x:cx,y:cy},{x:cx+1,y:cy}];
    dir = {x:1,y:0}; nextDir = null; score = 0; moves=0; food=null; obstacles=[]; lastFoodClearedAt = 0;
    if(obstaclesToggle.checked){ generateObstacles(6); }
    renderScoreboard(); updateUI(); spawnFood(); draw();
  }

  function startGame(){ if(!running){ running=true; paused=false; lastTime = performance.now(); accumulator=0; tickRate = Math.max(1, parseInt(speedSel.value,10)); loop(lastTime); } }
  function pauseGame(){ paused = !paused; pauseBtn.textContent = paused ? 'Resume' : 'Pause'; }
  function gameOver(){ running=false; paused=true; if(score > highScore){ highScore = score; localStorage.setItem('snake_high', String(highScore)); bestEl.textContent = highScore; } addScoreEntry(score, wrapToggle.checked ? 'Wrap' : 'Classic', speedSel.value, snake.length); playSound('gameover'); canvas.style.boxShadow = '0 0 0 6px rgba(220,38,38,0.12), inset 0 2px 10px rgba(2,6,23,0.45)'; setTimeout(()=> canvas.style.boxShadow = '', 400); }

  function updateUI(){ scoreEl.textContent = score; movesEl.textContent = moves; lengthEl.textContent = snake.length; modeEl.textContent = wrapToggle.checked ? 'Wrap' : 'Classic'; }

  // tick
  function tick(){ if(nextDir){ if(!(nextDir.x === -dir.x && nextDir.y === -dir.y)) dir = nextDir; nextDir = null; }
    const head = { x: snake[snake.length-1].x + dir.x, y: snake[snake.length-1].y + dir.y };
    moves++;
    // wrap or wall
    if(wrapToggle.checked){ head.x = (head.x + cols) % cols; head.y = (head.y + rows) % rows; }
    // collision: walls
    if(!wrapToggle.checked){ if(head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows){ gameOver(); return; } }
    // collision: obstacles
    if(inObstacles(head.x, head.y)){ gameOver(); return; }
    // collision: self
    if(inSnake(head.x, head.y)) { gameOver(); return; }

    snake.push(head);
    // eat
    if(food && head.x === food.x && head.y === food.y){ // points by type
      const pts = food.type === 'normal' ? 1 : (food.type === 'bonus' ? 3 : 1);
      score += pts; playSound('eat'); clearFood(); // spawn delayed
      // small chance to spawn extra obstacles when bonus eaten
      if(obstaclesToggle.checked && Math.random() > 0.85){ generateObstacles(6 + Math.floor(score/5)); }
    } else {
      snake.shift();
    }
    // spawn food if none
    if(!food){ // small delay handled by spawnFood using lastFoodClearedAt
      spawnFood();
    }
    // if food exists and expired
    if(food && food.expires && performance.now() > food.expires){ clearFood(); }

    // speed scaling
    tickRate = Math.min(30, parseInt(speedSel.value,10) + Math.floor(score/6));
    updateUI();
  }

  // drawing
  function draw(){ const sizePx = Math.min(canvas.width, canvas.height) / (window.devicePixelRatio || 1); ctx.clearRect(0,0,sizePx,sizePx);
    const g = ctx.createLinearGradient(0,0,0,sizePx); g.addColorStop(0,'rgba(12,22,36,0.9)'); g.addColorStop(1,'rgba(7,14,28,1)'); ctx.fillStyle = g; ctx.fillRect(0,0,sizePx,sizePx);
    // obstacles
    for(const o of obstacles){ const x = o.x*cellSize; const y = o.y*cellSize; ctx.fillStyle = obstacleColor; roundRect(ctx,x+1,y+1,cellSize-2,cellSize-2,Math.max(2,cellSize*0.12)); ctx.fill(); }
    // food
    if(food){ const time = performance.now(); const pulse = 0.85 + 0.25*Math.sin((time-food.created)/200); const fx = food.x*cellSize; const fy = food.y*cellSize; const padding = cellSize*0.12; const r = (cellSize-padding*2)*0.5*pulse; ctx.beginPath(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.ellipse(fx+cellSize/2+1.5, fy+cellSize/2+2, r*0.8, r*0.4,0,0,Math.PI*2); ctx.fill(); const fg = ctx.createLinearGradient(fx,fy,fx+cellSize,fy+cellSize); if(food.type==='normal'){ fg.addColorStop(0,'#ffb469'); fg.addColorStop(1,foodColor);} else { fg.addColorStop(0,'#ff9aa2'); fg.addColorStop(1,bonusFoodColor);} ctx.beginPath(); ctx.ellipse(fx+cellSize/2, fy+cellSize/2, r, r, 0, 0, Math.PI*2); ctx.fillStyle = fg; ctx.fill(); }
    // snake
    for(let i=0;i<snake.length;i++){ const s=snake[i]; const x=s.x*cellSize, y=s.y*cellSize; const isHead = i===snake.length-1; ctx.beginPath(); const radius = Math.max(2, cellSize*0.14); const t = i / Math.max(1, snake.length-1); const bodyGrad = ctx.createLinearGradient(x,y,x+cellSize,y+cellSize); bodyGrad.addColorStop(0, mixColor(snakeBodyColorA, snakeBodyColorB, t)); bodyGrad.addColorStop(1, mixColor(snakeBodyColorB, snakeBodyColorA, t)); ctx.fillStyle = isHead ? snakeHeadColor : bodyGrad; roundRect(ctx,x+1,y+1,cellSize-2,cellSize-2,radius); ctx.fill(); if(isHead){ ctx.fillStyle = '#071427'; const eyeR = Math.max(1, cellSize*0.08); ctx.beginPath(); ctx.ellipse(x+cellSize*0.32, y+cellSize*0.35, eyeR, eyeR, 0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x+cellSize*0.68, y+cellSize*0.35, eyeR, eyeR, 0,0,Math.PI*2); ctx.fill(); } }
  }

  function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function hexToRgb(hex){ const h=hex.replace('#',''); if(h.length===3) return {r:parseInt(h[0]+h[0],16),g:parseInt(h[1]+h[1],16),b:parseInt(h[2]+h[2],16)}; return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; }
  function mixColor(a,b,t){ const pa=hexToRgb(a), pb=hexToRgb(b); const r=Math.round(pa.r*(1-t)+pb.r*t); const g=Math.round(pa.g*(1-t)+pb.g*t); const bl=Math.round(pa.b*(1-t)+pb.b*t); return `rgb(${r},${g},${bl})`; }

  // audio
  function ensureAudio(){ if(!audioCtx){ try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audioCtx=null; } } }
  function playSound(type){ if(!snd) return; ensureAudio(); if(!audioCtx) return; const now=audioCtx.currentTime; if(type==='eat'){ const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type='sine'; o.frequency.setValueAtTime(700,now); o.frequency.exponentialRampToValueAtTime(1400, now+0.08); g.gain.setValueAtTime(0.0025,now); g.gain.exponentialRampToValueAtTime(0.0001, now+0.1); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+0.12);} else if(type==='gameover'){ const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(220,now); o.frequency.exponentialRampToValueAtTime(80, now+0.3); g.gain.setValueAtTime(0.006,now); g.gain.exponentialRampToValueAtTime(0.0001, now+0.4); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+0.32);} }

  // loop
  function loop(time){ rafId = requestAnimationFrame(loop); if(!running || paused){ draw(); lastTime=time; return; } const dt=(time-lastTime)/1000; lastTime=time; accumulator += dt; const secPerTick = 1 / Math.max(1, tickRate); while(accumulator >= secPerTick){ tick(); accumulator -= secPerTick; } draw(); }

  // input
  window.addEventListener('keydown', (e)=>{ if(e.key===' '){ e.preventDefault(); pauseGame(); return; } const map={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],W:[0,-1],S:[0,1],A:[-1,0],D:[1,0]}; const k=e.key; if(map[k]){ const [x,y]=map[k]; nextDir={x,y}; if(!running) startGame(); } });
  let touchStart=null;
  canvas.addEventListener('pointerdown', (ev)=>{ touchStart={x:ev.clientX,y:ev.clientY,t:performance.now()}; });
  canvas.addEventListener('pointerup', (ev)=>{ if(!touchStart) return; const dx=ev.clientX-touchStart.x; const dy=ev.clientY-touchStart.y; const adx=Math.abs(dx), ady=Math.abs(dy); if(Math.max(adx,ady) < 10){ if(!running) startGame(); else pauseGame(); } else { if(adx > ady) nextDir = {x: dx>0?1:-1, y:0}; else nextDir = {x:0, y: dy>0?1:-1}; if(!running) startGame(); } touchStart=null; });
  touchButtons.forEach(btn=> btn.addEventListener('click', ()=>{ const d = btn.dataset.dir; if(d==='up') nextDir={x:0,y:-1}; if(d==='down') nextDir={x:0,y:1}; if(d==='left') nextDir={x:-1,y:0}; if(d==='right') nextDir={x:1,y:0}; if(!running) startGame(); }));

  // buttons
  startBtn.addEventListener('click', ()=>{ startGame(); startBtn.blur(); });
  pauseBtn.addEventListener('click', ()=>{ pauseGame(); pauseBtn.blur(); });
  resetBtn.addEventListener('click', ()=>{ resetGame(); startGame(); resetBtn.blur(); });
  speedSel.addEventListener('change', ()=>{ tickRate = Math.max(1, parseInt(speedSel.value,10)); });
  soundToggle.addEventListener('click', ()=>{ snd = !snd; soundToggle.textContent = snd ? '🔊' : '🔈'; if(snd) ensureAudio(); });
  obstaclesToggle.addEventListener('change', ()=>{ if(obstaclesToggle.checked) generateObstacles(6); else obstacles = []; draw(); });

  // initialize
  resizeCanvas(); resetGame(); draw(); renderScoreboard();
  document.body.addEventListener('pointerdown', function once(){ ensureAudio(); document.body.removeEventListener('pointerdown', once); }, { once:true });

  // expose for debugging
  window.SnakeGame = { start: startGame, pause: pauseGame, reset: resetGame, getState: ()=>({snake,food,score}) };
})();
