const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function boot() {
      if (!window.gsap) { document.getElementById("p").textContent += " (GSAP blocked — use HTTPS + static server.)"; return; }
      if (reduce) return;
      gsap.from("#h", { y: 18, opacity: 0, duration: 0.9, ease: "power3.out" });
      gsap.from("#p", { y: 10, opacity: 0, duration: 0.8, delay: 0.1, ease: "power3.out" });
      gsap.from(".chip", { y: 10, opacity: 0, stagger: 0.06, duration: 0.55, delay: 0.25, ease: "back.out(1.6)" });
      document.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          gsap.fromTo(btn, { scale: 1 }, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.inOut" });
        });
      });
    }
    addEventListener("DOMContentLoaded", boot);
