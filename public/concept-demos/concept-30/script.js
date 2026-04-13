const palettes = [
      {bg:"#f6f7fb",fg:"#0b1020",a:"#0066ff"},
      {bg:"#0b0d12",fg:"#e9edf5",a:"#7cf0ff"},
      {bg:"#fff6ea",fg:"#241612",a:"#ff6a3d"},
      {bg:"#f3f6f4",fg:"#1e2a24",a:"#2f7d57"},
    ];
    function roll() {
      const p = palettes[(Math.random() * palettes.length) | 0];
      document.documentElement.style.setProperty("--bg", p.bg);
      document.documentElement.style.setProperty("--fg", p.fg);
      document.documentElement.style.setProperty("--a", p.a);
      const dense = Math.random() > 0.55;
      document.documentElement.style.setProperty("--gap", dense ? ".65rem" : "1.25rem");
      document.documentElement.style.setProperty("--h", dense ? "clamp(1.6rem,3vw,2.2rem)" : "clamp(2rem,5vw,3.2rem)");
      const root = document.getElementById("root");
      [...root.querySelectorAll(".block")].sort(() => Math.random() - 0.5).forEach((el) => root.appendChild(el));
    }
    document.getElementById("roll").addEventListener("click", roll);
    roll();
