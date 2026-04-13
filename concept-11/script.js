const c = document.getElementById("orb");
    const ctx = c.getContext("2d");
    let mx = 0, my = 0, t = 0;
    addEventListener("pointermove", (e) => { const r = c.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5; });
    function draw() {
      t += 0.016;
      const w = c.width, h = c.height;
      ctx.clearRect(0,0,w,h);
      const pulse = 0.55 + Math.sin(t * 2.2) * 0.08;
      const g = ctx.createRadialGradient(w*(.5+mx*.15), h*(.42+my*.12), 40, w*.5, h*.45, h*.65);
      g.addColorStop(0, "rgba(0,102,255," + (0.55*pulse) + ")");
      g.addColorStop(0.35, "rgba(126,240,255," + (0.25*pulse) + ")");
      g.addColorStop(0.7, "rgba(20,30,60," + (0.35*pulse) + ")");
      g.addColorStop(1, "rgba(2,3,8,0.95)");
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w/2, h/2, h*0.18 + Math.sin(t*3)*6, 0, Math.PI*2); ctx.stroke();
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
