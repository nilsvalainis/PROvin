const chk = document.getElementById("annual");
    function sync() {
      document.querySelectorAll(".amt").forEach((el) => {
        const n = chk.checked ? el.dataset.a : el.dataset.m;
        el.textContent = "€" + n;
      });
    }
    chk.addEventListener("change", sync); sync();
