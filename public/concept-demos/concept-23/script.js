const arc = document.getElementById("arc");
    const n = document.getElementById("n");
    const C = 2 * Math.PI * 52;
    function run() {
      const target = Math.round(42 + Math.random() * 40);
      let cur = 0;
      const t0 = performance.now();
      function frame(t) {
        const p = Math.min(1, (t - t0) / 1200);
        cur = Math.round(target * (0.5 - Math.cos(Math.PI * p) / 2));
        n.textContent = String(cur);
        const dash = (cur / 100) * C;
        arc.setAttribute("stroke-dasharray", dash + " " + C);
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    document.getElementById("replay").addEventListener("click", run);
    run();
