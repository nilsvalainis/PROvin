document.getElementById("hack").addEventListener("click", () => {
      const v = (document.getElementById("vin").value || "").toUpperCase();
      document.getElementById("log").textContent = v.length >= 11
        ? "[OK] TRACE SPOOFED\nHASH: 0x" + [...v].map((c)=>c.charCodeAt(0).toString(16)).join("").slice(0,32)
        : "[ERR] INSUFFICIENT BYTES";
    });
