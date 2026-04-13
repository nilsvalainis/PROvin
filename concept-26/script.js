addEventListener("DOMContentLoaded", () => {
      if (!window.L) { document.getElementById("map").textContent = "Leaflet failed to load — check network / CSP."; return; }
      const map = L.map("map").setView([56.95, 24.1], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      L.marker([56.95, 24.1]).addTo(map).bindPopup("Demo origin marker");
    });
