// Nombre visible de la clínica para los mockups HTML y el catálogo del design system.
const BRAND_NAME = "Clínica Dental Alvear";
const BRAND_PROVISIONAL = false;

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
