# Bitácora de decisiones

Una fila por cada vez que el agente termina una etapa o un artefacto. Sirve para la reflexión escrita y el video.

> ⚠️ **Cuidado: este archivo lo editamos los 6.** Agregá tu fila **solo al final de la tabla** y no modifiques ni borres filas de otros. Si GitHub marca conflicto en este archivo, resolvelo **conservando las filas de los dos lados** (la tuya y la del compañero), sin los marcadores `<<<<<<<`, `=======` y `>>>>>>>`. Si no estás seguro, avisale a EP antes de mergear.

| Fecha | Etapa | Quién | Qué generó el agente | Decisión (Continuar / Ajustar / Parar) | Por qué |
|---|---|---|---|---|---|
| 2026-11-21 | 0 | EP | — | — | Repo creado, ramas por integrante y reglas de colaboración. |
| 2026-11-21 | 1 | EP | Plan de fundación de `/active-orchestrator` | Continuar | Ruta de fundación con todas las fases que pide la consigna. |
| 2026-11-21 | 2 | EP | Entrevista del discovery (checklist de 11 puntos) | Ajustar | Se mantiene la recepcionista (agenda, modifica y cancela). La reserva online pasa a imprescindible, con email y botón de Google Calendar. El paciente tiene cuenta. |
| 2026-11-21 | 2 | EP | PDF del informe con la verificación de fuentes | Ajustar (2 veces) | Faltaban los tipos de fuente "video" y "marketplace"; quedaba el bloque "Borrador"; las verificaciones parciales no corregían el cuerpo; el nombre del archivo estaba mal. |
| 2026-11-21 | 2 | EP | Selección de sistemas y fuentes | Continuar | Se excluyó Benty por no tener fuente oficial, y no se tomó la certificación CENS de AgendaPro porque es de Chile. |
| 2026-11-21 | 2 | EP | Verificación de Dentalink | Ajustar | Dentalink documenta el box y el sobreagendamiento: se corrigieron A.1, B y C.3. |
| 2026-11-21 | 2 | EP | Terminología del informe | Ajustar | Se reemplazó "sillón" por "box" en todo el proyecto. |
| 2026-11-21 | 3 | EP | Comparación de 4 stacks | Continuar | Node + TypeScript: ya está instalado en todas las PC porque lo exige OpenSpec. |
| 2026-11-21 | 3 | EP | Preguntas PA-01 y PA-02 | Ajustar | El paciente reserva con cuenta. Cada profesional carga sus horarios. |
| 2026-11-21 | 3 | EP | Política visual (`visual-design`) | Ajustar y Parar | Pasó de off a system-and-mockups y después se pospuso la aprobación del design system. |
| 2026-11-21 | 3 | EP | `10_preguntas_abiertas.md` | Ajustar | Pasó de 9 a 21 puntos "No evidenciado" (NE-01 a NE-21), como pide la consigna. |
| 2026-11-21 | 3 | EP | Revisión de la KB contra el informe (IN-04) | Ajustar | El conteo de sistemas sin precio publicado pasó de 7 a 8 de 16, corregido en el .md, el Google Doc y el PDF. |
| 2026-11-22 | 4 | EP | `CHANGES.md` con 19 changes | Ajustar y Continuar | Quedaron 15 changes. Se agregó la gestión de pacientes que faltaba (US-004). Agustin quedó con los changes más simples. La API va en `src/` con un módulo por change (DD-13). No se aprueba todavía el design system. |
| 2026-11-22 | 5 | EP | find-skill: 8 skills recomendadas; registry regenerado; 10 reglas duras candidatas | Ajustar y Continuar | Se instalaron 7 (se descartó zod, que puede asumir Zod 4). Se reemplazó el registry de gentle-ai: no tenía las skills nuevas y exponía rutas locales. Las 10 reglas se revisaron una por una; 5 de dominio se agregaron a mano. La regla de commits se limitó a `main`: en su rama, cada uno commitea como prefiera. La BIBLIA pasó a `docs/` como contexto del agente. La bitácora queda en un solo archivo, con advertencia. |
