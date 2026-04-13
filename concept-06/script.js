let riskChart, mileChart;
    function rand(){ return Math.round(40 + Math.random()*55); }
    function build() {
      const risk = document.getElementById("cRisk");
      const mile = document.getElementById("cMileage");
      if (typeof Chart === "undefined") { risk.insertAdjacentHTML("afterend", "<p>Chart.js blocked — use a static server.</p>"); return; }
      riskChart?.destroy(); mileChart?.destroy();
      riskChart = new Chart(risk, { type: "bar", data: { labels:["Regs","Dealers","Ads","Photos"], datasets:[{ label:"Risk factors", data:[rand(),rand(),rand(),rand()], backgroundColor:"rgba(0,102,255,.55)" }]}, options:{ plugins:{legend:{labels:{color:"#dfe3ea"}}}, scales:{ x:{ticks:{color:"#9aa3ad"},grid:{color:"rgba(255,255,255,.06)"}}, y:{ticks:{color:"#9aa3ad"},grid:{color:"rgba(255,255,255,.06)"}}}}});
      mileChart = new Chart(mile, { type: "line", data: { labels:["Y-5","Y-4","Y-3","Y-2","Y-1","Now"], datasets:[{ label:"Odometer (k km, fake)", data:[120,132,138,151,160,168].map((n)=>n+Math.round(Math.random()*6)), borderColor:"#9fe870", tension:.35, fill:false }]}, options:{ plugins:{legend:{labels:{color:"#dfe3ea"}}}, scales:{ x:{ticks:{color:"#9aa3ad"},grid:{color:"rgba(255,255,255,.06)"}}, y:{ticks:{color:"#9aa3ad"},grid:{color:"rgba(255,255,255,.06)"}}}}});
    }
    document.getElementById("btn").addEventListener("click", build);
    addEventListener("DOMContentLoaded", build);
