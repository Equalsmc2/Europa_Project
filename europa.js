document.addEventListener("DOMContentLoaded", () => {
  
  // TECTONIC SECTORS & THEIR APPROXIMATE LAT/LON CENTERS
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

  let planetGroup, marker, planetRadius = 1;
  const tectonicPlates = {}; // Stores lines and sprites for admin control

  const initEuropa3D = () => {
    const container = document.getElementById('europa-3d');
    if (!container) return;
    
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 4;
    
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
    controls.autoRotateSpeed = 0.5;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, 3);
    scene.add(dirLight);

    planetGroup = new THREE.Group();
    scene.add(planetGroup);

    // Core Location Marker
    const markerGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xff3366 }); 
    marker = new THREE.Mesh(markerGeo, markerMat);
    marker.visible = false;
    planetGroup.add(marker);

    const loader = new THREE.GLTFLoader();
    loader.load('europa.glb', (gltf) => {
      const planetModel = gltf.scene;

      const box = new THREE.Box3().setFromObject(planetModel);
      const center = box.getCenter(new THREE.Vector3());
      planetModel.position.sub(center);
      
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      planetRadius = sphere.radius;
      
      planetGroup.add(planetModel);

      // GENERATE JAGGED TECTONIC BOUNDARIES & TEXT LABELS
      const platesGroup = new THREE.Group();
      
      Object.keys(europaLocations).forEach((locKey) => {
        const loc = europaLocations[locKey];
        
        // 1. Calculate Target Position on Sphere
        const phi = (90 - loc.lat) * (Math.PI / 180);
        const theta = (loc.lon + 180) * (Math.PI / 180);
        const R = planetRadius;

        const tx = -(R * Math.sin(phi) * Math.cos(theta));
        const tz = (R * Math.sin(phi) * Math.sin(theta));
        const ty = (R * Math.cos(phi));
        const targetPos = new THREE.Vector3(tx, ty, tz);

        // 2. Procedurally Generate a Jagged Line Boundary
        const points = [];
        const numPoints = 40; // Detail of the jagged edge
        const basePlateRadius = R * (0.25 + Math.random() * 0.15); // Random plate size

        for(let i = 0; i <= numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          // Add heavy randomization for that natural jagged tectonic look
          const jaggedRadius = basePlateRadius * (1 + (Math.random() * 0.5 - 0.25)); 
          
          const x = Math.cos(angle) * jaggedRadius;
          const y = Math.sin(angle) * jaggedRadius;
          // Project flat circle onto spherical cap
          const z = Math.sqrt(Math.max(0, R*R - x*x - y*y)); 
          
          points.push(new THREE.Vector3(x, y, z).setLength(R * 1.01)); // Hover slightly above surface
        }
        
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.35 });
        const lineMesh = new THREE.Line(lineGeo, lineMat);

        // Snap the flat generated boundary to the correct Lat/Lon on the planet
        lineMesh.position.set(0, 0, 0);
        lineMesh.lookAt(targetPos);
        platesGroup.add(lineMesh);

        // 3. Generate the Text Label (Sprite)
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#00f0ff'; // Cyan default
        ctx.font = "Bold 40px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(locKey.toUpperCase(), 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.6 });
        const sprite = new THREE.Sprite(spriteMat);
        
        // Scale and position the text slightly higher than the boundary so it pops
        sprite.scale.set(1.2, 0.3, 1);
        sprite.position.copy(targetPos).setLength(R * 1.06); 
        platesGroup.add(sprite);

        // Store references to update colors dynamically during admin commands
        tectonicPlates[locKey] = { line: lineMesh, sprite: sprite, ctx: ctx, texture: texture };
      });

      planetGroup.add(platesGroup);

    }, undefined, (error) => {
      console.warn("Europa.glb not found in root directory.");
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

  // Function to activate target plate and move marker
  window.updatePlanetMarker = (locationName) => {
    if(!locationName) return;
    const cleanName = locationName.toLowerCase();
    const loc = europaLocations[cleanName];
    
    // Reset all plates and text to default Cyan
    Object.keys(tectonicPlates).forEach(key => {
      const p = tectonicPlates[key];
      p.line.material.color.setHex(0x00f0ff);
      p.line.material.opacity = 0.35;
      
      p.ctx.clearRect(0, 0, 512, 128);
      p.ctx.fillStyle = '#00f0ff';
      p.ctx.fillText(key.toUpperCase(), 256, 64);
      p.texture.needsUpdate = true;
      p.sprite.material.opacity = 0.6;
    });

    if(!loc || !marker) { 
      marker.visible = false; 
      return; 
    }

    // Highlight the active tectonic plate and text to Chartreuse
    const activePlate = tectonicPlates[cleanName];
    if(activePlate) {
      activePlate.line.material.color.setHex(0xccff00); 
      activePlate.line.material.opacity = 1.0;
      
      activePlate.ctx.clearRect(0, 0, 512, 128);
      activePlate.ctx.fillStyle = '#ccff00';
      activePlate.ctx.fillText(cleanName.toUpperCase(), 256, 64);
      activePlate.texture.needsUpdate = true;
      activePlate.sprite.material.opacity = 1.0;
    }

    marker.visible = true;
    const phi = (90 - loc.lat) * (Math.PI / 180);
    const theta = (loc.lon + 180) * (Math.PI / 180);
    const R = planetRadius * 1.04; 

    marker.position.x = -(R * Math.sin(phi) * Math.cos(theta));
    marker.position.z = (R * Math.sin(phi) * Math.sin(theta));
    marker.position.y = (R * Math.cos(phi));
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
    Cilix Crater, Minos Linea, Rhadamanthys Linea, Castalia Macula`,
    
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
