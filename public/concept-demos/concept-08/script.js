document.querySelectorAll(".hit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const li = btn.closest(".item");
        const open = li.classList.contains("open");
        document.querySelectorAll(".item").forEach((x) => x.classList.remove("open"));
        if (!open) li.classList.add("open");
      });
    });
