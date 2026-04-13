const vin = document.getElementById("vin");
    const msg = document.getElementById("msg");
    function sync() {
      const v = vin.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (vin.value !== v) vin.value = v;
      if (!v) { msg.textContent = ""; return; }
      if (v.length < 17) { msg.textContent = "Need " + (17 - v.length) + " more characters"; return; }
      const bad = /[IOQ]/.test(v);
      msg.textContent = bad ? "Letters I, O, Q are not used in VINs" : "Format OK (demo only)";
    }
    vin.addEventListener("input", sync);
