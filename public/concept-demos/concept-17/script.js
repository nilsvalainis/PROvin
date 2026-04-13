const blob = document.querySelector(".blob");
    addEventListener("scroll", () => {
      const y = scrollY * 0.12;
      blob.style.setProperty("--ty", y + "px");
      document.querySelectorAll(".panel").forEach((p) => {
        const r = p.getBoundingClientRect();
        const vis = 1 - Math.min(1, Math.abs(r.top + r.height/2 - innerHeight/2) / (innerHeight*0.9));
        p.style.opacity = String(0.35 + 0.65 * vis);
      });
    });
