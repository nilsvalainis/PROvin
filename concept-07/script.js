const cap = document.getElementById("cap");
    addEventListener("scroll", () => {
      const t = Math.min(1, scrollY / 400);
      cap.style.opacity = String(0.65 + 0.35 * (1 - t));
    });
