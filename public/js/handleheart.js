  // ❤️ 3. Handle heart icon toggle
  document.querySelectorAll(".heart-icon").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const foodId = button.dataset.id;

      try {
        const res = await fetch("/favorites/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mealId:foodId })
        });

        if (res.ok) {
          const path = button.querySelector("svg path");
          const isFavorited = path.getAttribute("fill") === "red";

          if (isFavorited) {
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", "red");
            path.setAttribute("stroke-width", "2");
          } else {
            path.setAttribute("fill", "red");
            path.removeAttribute("stroke");
            path.removeAttribute("stroke-width");
          }
        }
      } catch (err) {
        console.error("❌ Heart toggle failed:", err);
      }
    });
  });