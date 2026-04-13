document.getElementById("go").addEventListener("click", () => {
      const v = (document.getElementById("vin").value || "").toUpperCase().replace(/\s/g,"");
      document.getElementById("out").textContent = v.length >= 11
        ? "DEMO OUTPUT\nSTATUS: OK\nCHECKSUM: FAKE\nVIN: " + v
        : "ERROR: NEED >=11 CHARS";
    });
