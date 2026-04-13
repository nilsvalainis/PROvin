let step = 0;
    const fill = document.getElementById("fill");
    function show(i) {
      document.querySelectorAll(".step").forEach((s, j) => s.classList.toggle("hidden", j !== i));
      fill.style.width = ((i + 1) / 3 * 100) + "%";
      step = i;
    }
    document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => {
      if (step === 0 && document.getElementById("vin").value.trim().length < 11) { alert("Enter at least 11 chars (demo)."); return; }
      show(Math.min(2, step + 1));
    }));
    document.getElementById("reset").addEventListener("click", () => { document.getElementById("vin").value = ""; show(0); fill.style.width = "0%"; });
    show(0);
