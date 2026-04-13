const io = new IntersectionObserver((ents) => {
      for (const e of ents) { if (e.isIntersecting) e.target.classList.add("on"); }
    }, { threshold: 0.2 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
