const log = document.getElementById("log");
    function println(s){ log.textContent += s + "\n"; log.scrollTop = log.scrollHeight; }
    println("provinc-audit-shell v0 (demo)");
    println("try: decode <VIN>");
    document.getElementById("f").addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = document.getElementById("cmd").value.trim();
      document.getElementById("cmd").value = "";
      println("$ " + raw);
      const m = raw.match(/^decode\s+([A-Z0-9]{11,17})$/i);
      if (!m) { println("err: usage decode <VIN>"); return; }
      const v = m[1].toUpperCase();
      println("[info] normalizing…");
      println("[ok] checksum: FAKE");
      println("[ok] wmi: " + v.slice(0,3) + " (demo)");
    });
