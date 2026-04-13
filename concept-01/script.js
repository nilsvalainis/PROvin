const root = document.documentElement;
    addEventListener("pointermove", (e) => {
      root.style.setProperty("--mx", (e.clientX / innerWidth) * 100 + "%");
      root.style.setProperty("--my", (e.clientY / innerHeight) * 100 + "%");
    });
    const panel = document.getElementById("panel");
    document.getElementById("decode")?.addEventListener("click", () => {
      const v = (document.getElementById("vin")?.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (v.length < 11) { panel.hidden = true; return; }
      panel.hidden = false;
      document.getElementById("p-region").textContent = "EU registry cluster (demo)";
      document.getElementById("p-checks").textContent = "12 signals matched";
      document.getElementById("p-flags").textContent = v.length === 17 ? "VIN length OK" : "Partial VIN";
    });
