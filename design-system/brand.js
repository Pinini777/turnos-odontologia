// Nombre visible del producto. Cambiarlo acá actualiza todas las previews y mockups.
// (TBD) El nombre definitivo no está decidido: mientras BRAND_PROVISIONAL sea true, se muestra la etiqueta "provisional".
const BRAND_NAME = "Agenda Odonto";
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
