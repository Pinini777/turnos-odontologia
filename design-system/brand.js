// Nombre visible del producto para los mockups HTML y el catálogo del design system.
const BRAND_NAME = "Consultorio Odontológico";
const BRAND_PROVISIONAL = true;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-brand-name]").forEach((el) => {
    el.textContent = BRAND_NAME;
  });
  document.querySelectorAll("[data-brand-provisional]").forEach((el) => {
    el.hidden = !BRAND_PROVISIONAL;
  });
  if (document.title.includes("{brand}")) {
    document.title = document.title.replace("{brand}", BRAND_NAME);
  }
});
