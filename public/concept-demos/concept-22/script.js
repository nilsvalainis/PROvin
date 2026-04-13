const track = document.getElementById("track");
    const dots = document.getElementById("dots");
    const pages = track.children.length;
    for (let i = 0; i < pages; i++) { const d = document.createElement("div"); d.className = "dot" + (i===0?" on":""); dots.appendChild(d); }
    let i = 0, startX = 0, dragging = false, dx = 0;
    function paint() {
      track.style.transform = "translateX(" + (-i * 100 + (dx / track.clientWidth) * 100) + "%)";
      [...dots.children].forEach((d, j) => d.classList.toggle("on", j === i));
    }
    function go(dir) { i = Math.max(0, Math.min(pages - 1, i + dir)); dx = 0; paint(); }
    track.addEventListener("pointerdown", (e) => { dragging = true; startX = e.clientX; track.setPointerCapture(e.pointerId); });
    track.addEventListener("pointermove", (e) => { if (!dragging) return; dx = e.clientX - startX; paint(); });
    track.addEventListener("pointerup", () => {
      if (!dragging) return; dragging = false;
      if (dx < -60) go(1); else if (dx > 60) go(-1); dx = 0; paint();
    });
    paint();
