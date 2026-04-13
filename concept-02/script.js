const thread = document.getElementById("thread");
    function addBubble(role, text) {
      const d = document.createElement("div");
      d.className = "bubble " + (role === "user" ? "user" : "bot");
      d.textContent = text; thread.appendChild(d); thread.scrollTop = thread.scrollHeight;
    }
    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
    async function typeBot(full) {
      const el = document.createElement("div"); el.className = "bubble bot typing"; el.textContent = ""; thread.appendChild(el);
      for (let i = 0; i <= full.length; i++) { el.textContent = full.slice(0, i); thread.scrollTop = thread.scrollHeight; await sleep(12 + Math.random() * 18); }
      el.classList.remove("typing");
    }
    function fakeAnswer(vin) {
      const clean = vin.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (clean.length < 11) return "I need at least 11 characters to fake a registry cluster match.";
      return "Demo insight:\n• WMI suggests passenger vehicle line.\n• Mileage anomaly risk: LOW (synthetic).\n• Compare listing photos vs trim (demo).";
    }
    document.getElementById("f").addEventListener("submit", async (e) => {
      e.preventDefault(); const q = document.getElementById("q"); const text = q.value.trim(); if (!text) return;
      addBubble("user", text); q.value = ""; await sleep(350); await typeBot(fakeAnswer(text));
    });
    addBubble("bot", "Hi — paste a VIN for a canned expert-style summary.");
