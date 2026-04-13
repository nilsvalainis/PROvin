const root = document.documentElement;
    const saved = localStorage.getItem("provinc_demo_theme");
    root.dataset.theme = saved === "light" ? "light" : "dark";
    const btn = document.getElementById("t");
    function sync(){ const light = root.dataset.theme === "light"; btn.setAttribute("aria-pressed", String(light)); btn.textContent = light ? "Dark" : "Light"; }
    sync();
    btn.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      localStorage.setItem("provinc_demo_theme", root.dataset.theme);
      sync();
    });
