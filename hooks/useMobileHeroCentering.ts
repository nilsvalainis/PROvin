/**
 * Agrāk: JS translateY pret visualViewport — izraisīja Safari raustīšanos.
 * Atstāts tukšs eksports, lai importi varētu palikt nesaistoši; pozicionēšanu veic CSS.
 */
export function useMobileHeroCentering(): { translateY: 0 } {
  return { translateY: 0 };
}
