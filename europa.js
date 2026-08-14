document.addEventListener("DOMContentLoaded", () => {
  
  // TECTONIC SECTORS & THEIR LAT/LON CENTERS
  const europaLocations = {
    "conamara chaos": { lat: 9.7, lon: 272.7 },
    "pwyll crater": { lat: -25.2, lon: 271.4 },
    "thera macula": { lat: -46.7, lon: 181.2 },
    "thrace macula": { lat: -45.9, lon: 172.1 },
    "cilix crater": { lat: 2.6, lon: 181.9 },
    "minos linea": { lat: 45.0, lon: 200.0 }, 
    "rhadamanthys linea": { lat: 30.0, lon: 150.0 }, 
    "castalia macula": { lat: -1.6, lon: 225.7 },
    "outpost zero": { lat: 0, lon: 0 }, 
    "abyssal gate": { lat: -80, lon: 45 } 
  };

  let planetGroup, planetRadius = 1;
  const tectonicPlates = {}; 

  const initEuropa3D = () => {
    const container = document.getElementById('europa-3d');
    if (!container) return;
    
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 4.5;
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    planetGroup = new THREE.Group();
    scene.add(planetGroup);

    const loader = new THREE.GLTFLoader();
    loader.load('europa.glb', (gltf) => {
      const planetModel = gltf.scene;

      // Center the model geometry cleanly using its bounding box
      const box = new THREE.Box3().setFromObject(planetModel);
      const center = box.getCenter(new THREE.Vector3());
      planetModel.position.sub(center);
      
      // Extract the precise radius from your GLB geometry bounds
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      planetRadius = sphere.radius;
      
      planetGroup.add(planetModel);

      // GENERATE JAGGED TECTONIC BOUNDARIES & TEXT LABELS FLUSH TO SURFACE
      const platesGroup = new THREE.Group();
      
      Object.keys(europaLocations).forEach((locKey) => {
        const loc = europaLocations[locKey];
        
        // Convert Lat/Lon to 3D space
        const phi = (90 - loc.lat) * (Math.PI / 180);
        const theta = (loc.lon + 180) * (Math.PI / 180);
        const R = planetRadius;

        const tx = -(R * Math.sin(phi) * Math.cos(theta));
        const tz = (R * Math.sin(phi) * Math.sin(theta));
        const ty = (R * Math.cos(phi));
        const targetPos = new THREE.Vector3(tx, ty, tz);

        // Procedural Jagged Tectonic Line Loop
        const points = [];
        const numPoints = 35; 
        const baseRadius = R * 0.35; // Sized nicely to fit segments onto the sphere

        for(let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          // Add procedural noise to make boundaries jagged like tectonic plates
          const noise = baseRadius * (0.7 + (Math.sin(i * 3) * 0.3) + (Math.random() * 0.2)); 
          
          const x = Math.cos(angle) * noise;
          const y = Math.sin(angle) * noise;
          const z = Math.sqrt(Math.max(0, R*R - x*x - y*y)); 
          
          // Align directly flush against the model's outer shell (R * 1.002)
          points.push(new THREE.Vector3(x, y, z).setLength(R * 1.002)); 
        }
        
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ 
          color: 0x00f0ff, 
          transparent: true, 
          opacity: 0.45 
        });
        
        const lineLoop = new THREE.LineLoop(lineGeo, lineMat);
        lineLoop.position.set(0, 0, 0);
        lineLoop.lookAt(targetPos);
        platesGroup.add(lineLoop);

        // Canvas Text Sprite inside the Plate
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = "Bold 40px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(locKey.toUpperCase(), 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ 
          map: texture, 
          color: 0x00f0ff, 
          transparent: true, 
          opacity: 0.7 
        });
        
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.9, 0.22, 1);
        // Position text precisely in the center of the plate region
        sprite.position.copy(targetPos).setLength(R * 1.02); 
        platesGroup.add(sprite);

        tectonicPlates[locKey] = { loop: lineLoop, sprite: sprite };
      });

      planetGroup.add(platesGroup);

    }, undefined, (error) => {
      console.warn("Europa.glb load error.");
    });

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    window.addEventListener('resize', () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
  };

  initEuropa3D();

  // Highlight active plate and text when admin command executes
  window.updatePlanetMarker = (locationName) => {
    if(!locationName) return;
    const cleanName = locationName.toLowerCase();
    
    Object.keys(tectonicPlates).forEach(key => {
      const p = tectonicPlates[key];
      p.loop.material.color.setHex(0x00f0ff);
      p.loop.material.opacity = 0.25;
      p.sprite.material.color.setHex(0x00f0ff);
      p.sprite.material.opacity = 0.4;
    });

    const loc = europaLocations[cleanName];
    if(!loc) return;

    const activePlate = tectonicPlates[cleanName];
    if(activePlate) {
      activePlate.loop.material.color.setHex(0xccff00); 
      activePlate.loop.material.opacity = 1.0;
      activePlate.sprite.material.color.setHex(0xccff00);
      activePlate.sprite.material.opacity = 1.0;
    }
  };

  // ==========================================
  // UI & TOOLS
  // ==========================================
  const tray = document.getElementById("side-tray");
  const toggleBtn = document.getElementById("tools-toggle");
  const closeBtn = document.getElementById("tray-close");

  if (toggleBtn) toggleBtn.addEventListener("click", () => tray.classList.add("open"));
  if (closeBtn) closeBtn.addEventListener("click", () => tray.classList.remove("open"));

  window.roll = (sides) => {
    const display = document.getElementById("dice-display");
    const result = Math.floor(Math.random() * sides) + 1;
    display.textContent = "CALCULATING...";
    setTimeout(() => { display.innerHTML = `d${sides}: <span style="color: #00f0ff">${result}</span>`; }, 150);
  };

  let calcExp = "";
  window.calc = (val) => {
    const screen = document.getElementById("calc-screen");
    if (val === "C") {
      calcExp = ""; screen.textContent = "0";
    } else if (val === "=") {
      try {
        const result = new Function('return ' + calcExp)();
        if (!isFinite(result)) throw new Error("Math Error");
        const finalResult = Number.isInteger(result) ? result : parseFloat(result.toFixed(4));
        screen.textContent = finalResult;
        calcExp = finalResult.toString();
      } catch (e) {
        screen.textContent = "ERR"; calcExp = "";
      }
    } else {
      if (calcExp === "" && ["*", "/", "+"].includes(val)) return;
      calcExp += val; screen.textContent = calcExp;
    }
  };

  // ==========================================
  // FIREBASE & TERMINAL LOGIC
  // ==========================================
  const config = {
    apiKey: "YOUR_API_KEY", 
    projectId: "europa-4b0d3" 
  };
  
  if (!firebase.apps.length) firebase.initializeApp(config);
  const db = firebase.firestore();

  const terminal = document.getElementById("terminal");
  const cli = document.getElementById("cli");
  let cache = { notes: [], inventory: [] };
  let cmdHistory = [];
  let historyIndex = -1;
  
  const updateClock = () => {
    const now = new Date();
    document.getElementById("system-clock").innerText = now.toLocaleTimeString('en-US', { hour12: false }) + " OMNINET";
  };
  setInterval(updateClock, 1000); updateClock();

  const log = (text, type = "normal") => {
    const div = document.createElement("div");
    div.classList.add("line", type);
    div.innerHTML = text.replace(/\n/g, "<br>");
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
  };

  const formatTime = (ms) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const loadData = async () => {
    try {
      const notesSnap = await db.collection("notes").orderBy("timestamp").get();
      cache.notes = notesSnap.docs.map(doc => doc.id);
      log("\nDATA LOGS:", "gold");
      if (notesSnap.empty) log(" [NULL] No logs found.", "system");
      else notesSnap.docs.forEach((doc, i) => { log(`<span class="timestamp">[${formatTime(doc.data().timestamp)}]</span> LOG_0${i + 1}: ${doc.data().text}`); });

      const invSnap = await db.collection("inventory").orderBy("timestamp").get();
      cache.inventory = invSnap.docs.map(doc => doc.id);
      log("\nCARGO / INVENTORY:", "gold");
      if (invSnap.empty) log(" [NULL] Cargo empty.", "system");
      else invSnap.docs.forEach((doc, i) => { log(` ITEM_0${i + 1}: ${doc.data().text}`); });
    } catch (err) { log(`[FATAL ERROR] DB Connection lost: ${err.message}`, "error"); }
  };

  db.collection("meta").doc("location").onSnapshot((doc) => {
    const locFooter = document.getElementById("europa-location-text");
    if (doc.exists) {
      const locName = doc.data().name;
      if (window.updatePlanetMarker) window.updatePlanetMarker(locName);
      if (locFooter) locFooter.innerText = `LOC_TRACK: ${locName.toUpperCase()}`;
    } else {
      if (locFooter) locFooter.innerText = "LOC_TRACK: OFFLINE";
    }
  });

  const commands = {
    help: () => `
    [ SYSTEM COMMANDS ]
    write [text]    → Save a new data log
    read            → Read all saved logs
    rm [#]          → Delete a log by number
    store [item]    → Add an item to cargo
    take [#]        → Remove an item from cargo
    inv             → Check cargo hold
    weather         → Check atmospheric conditions
    radio           → Intercept omninet signals
    location        → Check current topological sector
    bank [+/- amt]  → Manage manna/credits
    shop            → View requisition list
    buy [item]      → Requisition an item
    clear           → Clear display
    
    [ VALID LOCATIONS ]
    Conamara Chaos, Pwyll Crater, Thera Macula, Thrace Macula, 
    Cilix Crater, Minos Linea, Rhadamanthys Linea, Castalia Macula,
    Outpost Zero, Abyssal Gate`,
    
    write: async (t) => { if (!t) return "Syntax: write [text]"; await db.collection("notes").add({ text: t, timestamp: Date.now() }); return "Log saved."; },
    read: async () => {
      const snap = await db.collection("notes").orderBy("timestamp").get(); cache.notes = snap.docs.map(doc => doc.id);
      return snap.empty ? "[NULL] No logs exist." : snap.docs.map((doc, i) => `<span class="timestamp">[${formatTime(doc.data().timestamp)}]</span> LOG_0${i+1}: ${doc.data().text}`).join("\n");
    },
    rm: async (i) => {
      const idx = parseInt(i) - 1; if (isNaN(idx) || !cache.notes[idx]) return "Invalid log number.";
      await db.collection("notes").doc(cache.notes[idx]).delete(); return `Log deleted.`;
    },
    store: async (item) => { if (!item) return "Syntax: store [item]"; await db.collection("inventory").add({ text: item, timestamp: Date.now() }); return `'${item}' added to cargo.`; },
    inv: async () => {
      const snap = await db.collection("inventory").orderBy("timestamp").get(); cache.inventory = snap.docs.map(doc => doc.id);
      return snap.empty ? "Cargo empty." : snap.docs.map((doc, i) => `ITEM_0${i+1}: ${doc.data().text}`).join("\n");
    },
    take: async (i) => {
      const idx = parseInt(i) - 1; if (isNaN(idx) || !cache.inventory[idx]) return "Invalid cargo number.";
      const name = (await db.collection("inventory").doc(cache.inventory[idx]).get()).data().text;
      await db.collection("inventory").doc(cache.inventory[idx]).delete(); return `'${name}' removed from cargo.`;
    },
    weather: async () => { const doc = await db.collection("meta").doc("temperature").get(); return doc.exists ? `[ATMOSPHERE]: ${doc.data().text}` : "Sensors offline."; },
    radio: async () => { const doc = await db.collection("meta").doc("broadcast").get(); return doc.exists ? `[INTERCEPT]:\n"${doc.data().text}"` : "No signals detected."; },
    
    location: async () => { 
      const doc = await db.collection("meta").doc("location").get(); 
      return doc.exists ? `[TELEMETRY]: Current sector is ${doc.data().name.toUpperCase()}.` : "[TELEMETRY]: Signal lost."; 
    },

    bank: async (input) => {
      const goldRef = db.collection("meta").doc("gold"); const doc = await goldRef.get();
      let current = doc.exists ? doc.data().amount : 0;
      if (!input) return `[CREDITS]: ${current} available.`;
      const match = input.trim().match(/^([\+\-]?)(\d+)$/); if (!match) return "Syntax: bank +50";
      if (match[1] === "+") current += parseInt(match[2]); else if (match[1] === "-") current -= parseInt(match[2]); else current = parseInt(match[2]);
      await goldRef.set({ amount: current, timestamp: Date.now() }); return `Credits updated: ${current}.`;
    },
    shop: async () => {
      const snap = await db.collection("shop").orderBy("price").get(); if (snap.empty) return "Requisition list empty.";
      return snap.docs.map((doc, i) => `ITEM_0${i+1}: ${doc.data().name} — ${doc.data().price} Credits`).join("\n");
    },
    buy: async (itemName) => {
      if (!itemName) return "Syntax: buy [item]";
      const goldRef = db.collection("meta").doc("gold"); const currentGold = (await goldRef.get()).data()?.amount || 0;
      const shopSnap = await db.collection("shop").where("name", "==", itemName).limit(1).get();
      if (shopSnap.empty) return `Item '${itemName}' not found.`;
      const { price, name } = shopSnap.docs[0].data();
      if (currentGold < price) return `Denied. Requires ${price} Credits.`;
      await goldRef.set({ amount: currentGold - price, timestamp: Date.now() });
      await db.collection("inventory").add({ text: name, timestamp: Date.now() });
      await db.collection("shop").doc(shopSnap.docs[0].id).delete();
      return `Requisitioned '${name}'.\nBalance: ${currentGold - price} Credits.`;
    },
    "admin weather": async (t) => { if(!t) return "Error"; await db.collection("meta").doc("temperature").set({ text: t, timestamp: Date.now() }); return `Atmosphere updated.`; },
    "admin radio": async (t) => { if(!t) return "Error"; await db.collection("meta").doc("broadcast").set({ text: t, timestamp: Date.now() }); return `Broadcast updated.`; },
    "admin stock": async (input) => { const [n, p] = input.split(";"); await db.collection("shop").add({ name: n.trim(), price: parseInt(p), timestamp: Date.now() }); return `Stock updated.`; },
    
    "admin location": async (loc) => { 
      if(!loc) return "Error: admin location [name]"; 
      if (!europaLocations[loc.toLowerCase()]) return `Error: Unknown coordinates for '${loc}'. Check valid locations in 'help'.`;
      await db.collection("meta").doc("location").set({ name: loc, timestamp: Date.now() }); 
      return `Tracking beacon deployed to '${loc}'.`; 
    },
    
    clear: () => { terminal.innerHTML = ""; return ""; }
  };

  cli.addEventListener("keydown", async (e) => {
    if (e.key === "ArrowUp") { if (historyIndex > 0) { historyIndex--; cli.value = cmdHistory[historyIndex]; } e.preventDefault(); } 
    else if (e.key === "ArrowDown") { if (historyIndex < cmdHistory.length - 1) { historyIndex++; cli.value = cmdHistory[historyIndex]; } else { historyIndex = cmdHistory.length; cli.value = ""; } e.preventDefault(); }
    else if (e.key === "Enter") {
      const input = cli.value.trim(); if (!input) return;
      cmdHistory.push(input); historyIndex = cmdHistory.length; log(`[EXEC]> ${input}`, "user"); cli.value = "";
      const parts = input.split(/\s+/); const cmd = parts[0].toLowerCase(); const args = parts.slice(1);
      
      const isDm = cmd === "admin"; 
      const commandKey = (isDm && args.length > 0) ? `admin ${args[0].toLowerCase()}` : cmd; 
      const commandArgs = isDm ? args.slice(1).join(" ") : args.join(" ");
      
      try { 
        if (commands[commandKey]) { const result = await commands[commandKey](commandArgs); if (result) log(result); } 
        else { log(`Unknown command: '${commandKey}'. Type 'help'.`, "error"); } 
      } catch (err) { log(`[CRITICAL ERROR]: ${err.message}`, "error"); }
    }
  });

  loadData();

  const chatBox = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  if (chatBox && chatInput) {
    db.collection("relay_chat").orderBy("timestamp", "desc").limit(30).onSnapshot((snapshot) => {
      chatBox.innerHTML = ""; 
      snapshot.forEach((doc) => {
        const d = doc.data(); const div = document.createElement("div"); div.className = "chat-msg";
        div.innerHTML = `<span class="timestamp">[${formatTime(d.timestamp)}]</span><span class="user">PILOT_${doc.id.slice(0,4).toUpperCase()}> </span><span class="text">${d.text}</span>`;
        chatBox.appendChild(div);
      });
    });
    chatInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && chatInput.value.trim() !== "") {
        const text = chatInput.value.trim(); chatInput.value = ""; 
        try { await db.collection("relay_chat").add({ text: text, timestamp: Date.now() }); } catch (err) {}
      }
    });
  }
});
