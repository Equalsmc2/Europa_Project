document.addEventListener("DOMContentLoaded", () => {
  
  // 20 BASIC ENGLISH LOCATIONS
  const europaLocations = {
    "alpha base": { lat: 80, lon: 0 },
    "beta point": { lat: -80, lon: 0 },
    "delta hub": { lat: 45, lon: 45 },
    "echo site": { lat: 45, lon: 135 },
    "nova camp": { lat: 45, lon: 225 },
    "snow ridge": { lat: 45, lon: 315 },
    "ice valley": { lat: 0, lon: 0 },
    "deep trench": { lat: 0, lon: 72 },
    "frost peak": { lat: 0, lon: 144 },
    "iron bank": { lat: 0, lon: 216 },
    "zero point": { lat: 0, lon: 288 },
    "far zone": { lat: -45, lon: 45 },
    "high pass": { lat: -45, lon: 135 },
    "low camp": { lat: -45, lon: 225 },
    "main base": { lat: -45, lon: 315 },
    "red sector": { lat: 20, lon: 100 },
    "blue sector": { lat: -20, lon: 200 },
    "ghost town": { lat: 60, lon: 180 },
    "quiet zone": { lat: -60, lon: 270 },
    "last stop": { lat: -10, lon: 340 }
  };

  let planetGroup;
  let tectonicMesh, faceRegions = []; 
  const tectonicPlates = {}; 
  
  // Raycaster for Hover effect
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(-1, -1);
  let currentHover = null;
  let activeRegion = null;

  const initEuropa3D = () => {
    const container = document.getElementById('europa-3d');
    if (!container) return;
    
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 4.0;
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    planetGroup = new THREE.Group();
    scene.add(planetGroup);

    // Update mouse position for hovering
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
    
    // Clear hover when mouse leaves
    container.addEventListener('mouseleave', () => {
        mouse.x = -1;
        mouse.y = -1;
    });

    const loader = new THREE.GLTFLoader();
    loader.load('europa.glb', (gltf) => {
      const planetModel = gltf.scene;

      // FIX: Perfectly center the 3D model geometry using a wrapper
      const box = new THREE.Box3().setFromObject(planetModel);
      const center = box.getCenter(new THREE.Vector3());
      
      // Shift the model's actual geometry so it sits perfectly at 0,0,0
      planetModel.position.x = -center.x;
      planetModel.position.y = -center.y;
      planetModel.position.z = -center.z;
      
      // Place it in a wrapper so we can scale it cleanly from the true center
      const modelWrapper = new THREE.Group();
      modelWrapper.add(planetModel);
      
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      
      // USER REQUESTED RADIUS: 1.2
      const R = 2.0; 
      
      // Scale the wrapper so it fits perfectly inside the 1.2 radius grid
      const scaleFactor = (R * 0.985) / sphere.radius; 
      modelWrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);
      planetGroup.add(modelWrapper);

      // ==========================================
      // SEAMLESS VORONOI TECTONIC PLATES
      // ==========================================
      const platesGroup = new THREE.Group();
      
      const locNames = Object.keys(europaLocations);
      const locVectors = {};
      
      locNames.forEach(name => {
        const loc = europaLocations[name];
        const phi = (90 - loc.lat) * (Math.PI / 180);
        const theta = (loc.lon + 180) * (Math.PI / 180);
        locVectors[name] = new THREE.Vector3(
          -(R * Math.sin(phi) * Math.cos(theta)),
          (R * Math.cos(phi)),
          (R * Math.sin(phi) * Math.sin(theta))
        );
      });

      // Track data to center the text and draw hover borders
      const regionCentroids = {};
      const regionCounts = {};
      const regionTriangles = {};
      locNames.forEach(n => {
        regionCentroids[n] = new THREE.Vector3(0,0,0);
        regionCounts[n] = 0;
        regionTriangles[n] = [];
        tectonicPlates[n] = {};
      });

      // 1. Create a clean geometric sphere
      let baseGeo = new THREE.IcosahedronGeometry(R, 5);
      
      // 2. Add faint Hex/Geodesic wireframe overlay
      const wireMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.1 });
      const wireMesh = new THREE.LineSegments(new THREE.WireframeGeometry(baseGeo), wireMat);
      platesGroup.add(wireMesh);

      // 3. Convert to non-indexed geometry to color and shatter plates
      baseGeo = baseGeo.toNonIndexed();
      const pos = baseGeo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const transparentBlack = new THREE.Color(0x000000); // Invisible by default (No blue tint)

      // 4. Shatter the sphere: Assign every triangle to the closest location point
      for (let i = 0; i < pos.count; i += 3) {
          const vA = new THREE.Vector3().fromBufferAttribute(pos, i);
          const vB = new THREE.Vector3().fromBufferAttribute(pos, i+1);
          const vC = new THREE.Vector3().fromBufferAttribute(pos, i+2);
          const triCenter = new THREE.Vector3().addVectors(vA, vB).add(vC).divideScalar(3);

          let closestLoc = null;
          let minDist = Infinity;

          locNames.forEach(key => {
              let dist = triCenter.distanceTo(locVectors[key]);
              // Math noise creates the jagged, tectonic plate look
              dist += Math.sin(triCenter.x * 12 + locVectors[key].y) * Math.cos(triCenter.y * 12) * (R * 0.15);
              if(dist < minDist) {
                  minDist = dist;
                  closestLoc = key;
              }
          });

          faceRegions.push(closestLoc);
          regionCentroids[closestLoc].add(triCenter);
          regionCounts[closestLoc]++;
          regionTriangles[closestLoc].push(vA, vB, vC);

          for(let v = 0; v < 3; v++) {
              colors[(i+v)*3] = transparentBlack.r;
              colors[(i+v)*3+1] = transparentBlack.g;
              colors[(i+v)*3+2] = transparentBlack.b;
          }
      }
      baseGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // 5. Draw the solid plates
      const plateMat = new THREE.MeshBasicMaterial({
          vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false
      });
      tectonicMesh = new THREE.Mesh(baseGeo, plateMat);
      platesGroup.add(tectonicMesh);

      // 6. Generate the Hover Borders and Text Labels
      locNames.forEach(name => {
        // Average the face centers to find the TRUE center of the jagged plate
        if (regionCounts[name] > 0) {
            regionCentroids[name].divideScalar(regionCounts[name]);
            regionCentroids[name].setLength(R * 1.05); // Push text up so it hovers
        }

        // --- THE DOTTED/DASHED HOVER BORDER ---
        const regionGeo = new THREE.BufferGeometry().setFromPoints(regionTriangles[name]);
        const regionEdges = new THREE.EdgesGeometry(regionGeo, 5);
        const dashMat = new THREE.LineDashedMaterial({ 
            color: 0xccff00, 
            dashSize: 0.03, 
            gapSize: 0.03, 
            transparent: true, 
            opacity: 0.9 
        });
        const hoverOutline = new THREE.LineSegments(regionEdges, dashMat);
        hoverOutline.computeLineDistances(); // Crucial to make dashed lines work
        hoverOutline.visible = false; // Hidden until hovered
        platesGroup.add(hoverOutline);
        tectonicPlates[name].hoverOutline = hoverOutline;

        // --- THE TEXT SPRITE ---
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = "Bold 36px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(name.toUpperCase(), 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ 
          map: texture, color: 0x00f0ff, transparent: true, opacity: 0.6 // Dim cyan by default
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.6, 0.15, 1);
        sprite.position.copy(regionCentroids[name]); 
        platesGroup.add(sprite);
        tectonicPlates[name].sprite = sprite;
      });

      planetGroup.add(platesGroup);

    }, undefined, (error) => {
      console.warn("Europa.glb load error.");
    });

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      
      // ==========================================
      // HOVER LOGIC (RAYCASTER)
      // ==========================================
      if (tectonicMesh) {
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObject(tectonicMesh);
          
          let newHover = null;
          if(intersects.length > 0) {
              const faceIdx = Math.floor(intersects[0].faceIndex);
              newHover = faceRegions[faceIdx];
          }

          if(newHover !== currentHover) {
              // Deactivate old hover
              if(currentHover && tectonicPlates[currentHover]) {
                  tectonicPlates[currentHover].hoverOutline.visible = false;
                  // Only dim text if it's not the currently active admin region
                  if(currentHover !== activeRegion) {
                      tectonicPlates[currentHover].sprite.material.color.setHex(0x00f0ff);
                      tectonicPlates[currentHover].sprite.material.opacity = 0.6;
                  }
              }
              // Activate new hover
              if(newHover && tectonicPlates[newHover]) {
                  tectonicPlates[newHover].hoverOutline.visible = true;
                  tectonicPlates[newHover].sprite.material.color.setHex(0xccff00);
                  tectonicPlates[newHover].sprite.material.opacity = 1.0;
              }
              currentHover = newHover;
          }
      }

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

  // Highlight active plate (Solid Green) when admin command executes
  window.updatePlanetMarker = (locationName) => {
    if(!locationName || !tectonicMesh) return;
    const cleanName = locationName.toLowerCase();
    activeRegion = cleanName; // Save globally so hover logic respects it
    
    // Reset all text to dim Cyan
    Object.keys(tectonicPlates).forEach(key => {
      if(key !== currentHover) {
          tectonicPlates[key].sprite.material.color.setHex(0x00f0ff);
          tectonicPlates[key].sprite.material.opacity = 0.6;
      }
    });

    const activeColor = new THREE.Color(0xccff00).multiplyScalar(0.7); 
    const transparentBlack = new THREE.Color(0x000000); 
    const colors = tectonicMesh.geometry.attributes.color.array;

    for (let f = 0; f < faceRegions.length; f++) {
        const isTarget = (faceRegions[f] === cleanName);
        const c = isTarget ? activeColor : transparentBlack;

        for(let v = 0; v < 3; v++) {
            const idx = (f * 3 + v) * 3;
            colors[idx] = c.r;
            colors[idx+1] = c.g;
            colors[idx+2] = c.b;
        }
    }
    tectonicMesh.geometry.attributes.color.needsUpdate = true;

    if(tectonicPlates[cleanName]) {
       tectonicPlates[cleanName].sprite.material.color.setHex(0xccff00);
       tectonicPlates[cleanName].sprite.material.opacity = 1.0;
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
        screen.textContent = "ERR";
        calcExp = "";
      }
    } else {
      if (calcExp === "" && ["*", "/", "+"].includes(val)) return;
      calcExp += val;
      screen.textContent = calcExp;
    }
  };

  // ==========================================
  // FIREBASE & TERMINAL LOGIC
  // ==========================================
  const config = {
    apiKey: "AIzaSyB2nuuvLSrXQiHPRSWq-TwcTKEQ_Zedbz0",
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
    Alpha Base, Beta Point, Delta Hub, Echo Site, Nova Camp,
    Snow Ridge, Ice Valley, Deep Trench, Frost Peak, Iron Bank,
    Zero Point, Far Zone, High Pass, Low Camp, Main Base,
    Red Sector, Blue Sector, Ghost Town, Quiet Zone, Last Stop`,
    
    write: async (t) => { if (!t) return "Syntax: write [text]"; await db.collection("notes").add({ text: t, timestamp: Date.now() }); return "Log saved."; },
    read: async () => {
      const snap = await db.collection("notes").orderBy("timestamp").get(); cache.notes = snap.docs.map(doc => doc.id);
      return snap.empty ? "[NULL] No notes exist." : snap.docs.map((doc, i) => `<span class="timestamp">[${formatTime(doc.data().timestamp)}]</span> NOTE_0${i+1}: ${doc.data().text}`).join("\n");
    },
    rm: async (i) => {
      const idx = parseInt(i) - 1; if (isNaN(idx) || !cache.notes[idx]) return "[ERROR] Invalid note number.";
      await db.collection("notes").doc(cache.notes[idx]).delete(); return `[EXECUTED] Note_0${idx + 1} deleted.`;
    },
    store: async (item) => { if (!item) return "Syntax: store [item name]"; await db.collection("inventory").add({ text: item, timestamp: Date.now() }); return `[SUCCESS] '${item}' added to cargo.`; },
    inv: async () => {
      const snap = await db.collection("inventory").orderBy("timestamp").get(); cache.inventory = snap.docs.map(doc => doc.id);
      return snap.empty ? "[NULL] Cargo is empty." : snap.docs.map((doc, i) => `ITEM_0${i+1}: ${doc.data().text}`).join("\n");
    },
    take: async (i) => {
      const idx = parseInt(i) - 1; if (isNaN(idx) || !cache.inventory[idx]) return "[ERROR] Invalid item number.";
      const name = (await db.collection("inventory").doc(cache.inventory[idx]).get()).data().text;
      await db.collection("inventory").doc(cache.inventory[idx]).delete(); return `[EXECUTED] '${name}' removed from cargo.`;
    },
    weather: async () => { const doc = await db.collection("meta").doc("temperature").get(); return doc.exists ? `[WEATHER]: ${doc.data().text}` : "[ERROR] Sensors offline."; },
    radio: async () => { const doc = await db.collection("meta").doc("broadcast").get(); return doc.exists ? `[RADIO INTERCEPT]:\n"${doc.data().text}"` : "[SILENCE] No signals detected."; },
    
    location: async () => { 
      const doc = await db.collection("meta").doc("location").get(); 
      return doc.exists ? `[TELEMETRY]: Current sector is ${doc.data().name.toUpperCase()}.` : "[TELEMETRY]: Signal lost."; 
    },

    bank: async (input) => {
      const goldRef = db.collection("meta").doc("gold"); const doc = await goldRef.get();
      let current = doc.exists ? doc.data().amount : 0;
      if (!input) return `[BANK]: ${current} Credits available.`;
      const match = input.trim().match(/^([\+\-]?)(\d+)$/); if (!match) return "Syntax: bank +50 or bank -20";
      if (match[1] === "+") current += parseInt(match[2]); else if (match[1] === "-") current -= parseInt(match[2]); else current = parseInt(match[2]);
      await goldRef.set({ amount: current, timestamp: Date.now() }); return `[SUCCESS] Bank updated: ${current} Credits.`;
    },
    shop: async () => {
      const snap = await db.collection("shop").orderBy("price").get(); if (snap.empty) return "[NULL] Requisition list is empty.";
      return snap.docs.map((doc, i) => `ITEM_0${i+1}: ${doc.data().name} — <span style="color:#ccff00">${doc.data().price} Credits</span>`).join("\n");
    },
    buy: async (itemName) => {
      if (!itemName) return "Syntax: buy [item name]";
      const goldRef = db.collection("meta").doc("gold"); const currentGold = (await goldRef.get()).data()?.amount || 0;
      const shopSnap = await db.collection("shop").where("name", "==", itemName).limit(1).get();
      if (shopSnap.empty) return `[ERROR] Item '${itemName}' does not exist in the requisition list.`;
      const { price, name } = shopSnap.docs[0].data();
      if (currentGold < price) return `[DENIED] Insufficient funds. Requires ${price} Credits. You have ${currentGold}.`;
      await goldRef.set({ amount: currentGold - price, timestamp: Date.now() });
      await db.collection("inventory").add({ text: name, timestamp: Date.now() });
      await db.collection("shop").doc(shopSnap.docs[0].id).delete();
      return `[SUCCESS] Requisitioned '${name}'.\nRemaining Balance: ${currentGold - price} Credits.`;
    },
    "admin weather": async (t) => { if(!t) return "Syntax Error"; await db.collection("meta").doc("temperature").set({ text: t, timestamp: Date.now() }); return `[ADMIN] Atmosphere updated.`; },
    "admin radio": async (t) => { if(!t) return "Syntax Error"; await db.collection("meta").doc("broadcast").set({ text: t, timestamp: Date.now() }); return `[ADMIN] Broadcast updated.`; },
    "admin stock": async (input) => { const [n, p] = input.split(";"); await db.collection("shop").add({ name: n.trim(), price: parseInt(p), timestamp: Date.now() }); return `[ADMIN] '${n.trim()}' added to requisition list.`; },
    
    "admin location": async (loc) => { 
      if(!loc) return "Syntax: admin location [name]"; 
      if (!europaLocations[loc.toLowerCase()]) return `[ERROR] Unknown coordinates for '${loc}'.`;
      await db.collection("meta").doc("location").set({ name: loc, timestamp: Date.now() }); 
      return `[ADMIN] Tracking beacon deployed to '${loc}'.`; 
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
        else { log(`[ERROR] Unknown command: '${commandKey}'. Type 'help'.`, "error"); } 
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
