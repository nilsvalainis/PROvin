document.querySelector("input").addEventListener("input", (e) => {
      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
      e.target.value = v;
      document.getElementById("o").textContent = v.length >= 11 ? "DEMO OK\n" + v : "";
    });
