const h = document.querySelector(".hero");
    const k1 = document.querySelector(".k1");
    const k2 = document.querySelector(".k2");
    addEventListener("scroll", () => {
      const p = Math.min(1, scrollY / (innerHeight * 0.9));
      k1.style.transform = "translateX(" + (p * 18) + "px) skewX(" + (-4 * p) + "deg)";
      k2.style.transform = "translateX(" + (-p * 10) + "px) skewX(" + (3 * p) + "deg)";
      h.style.opacity = String(1 - p * 0.15);
    });
