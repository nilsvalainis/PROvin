const clk = document.getElementById("clk");
    setInterval(() => { clk.textContent = new Date().toLocaleTimeString(); }, 250);
