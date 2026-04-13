const card = document.getElementById("card");
    function on(e) {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = "rotateY(" + (x * 18) + "deg) rotateX(" + (-y * 14) + "deg)";
      card.style.setProperty("--sx", (x + .5) * 100 + "%");
      card.style.setProperty("--sy", (y + .5) * 100 + "%");
    }
    card.addEventListener("pointermove", on);
    card.addEventListener("pointerleave", () => { card.style.transform = "rotateY(0deg) rotateX(0deg)"; });
