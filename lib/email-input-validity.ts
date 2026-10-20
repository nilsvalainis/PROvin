/** Pārlūka native e-pasta kļūda (type=email) valodā no html lang / setCustomValidity. */

export function applyLocalizedEmailValidity(input: HTMLInputElement, message: string): void {
  if (input.validity.typeMismatch || (input.required && input.validity.valueMissing)) {
    input.setCustomValidity(message);
    return;
  }
  input.setCustomValidity("");
}

export function emailValidityLang(locale: string): string {
  if (locale === "en" || locale === "de" || locale === "ru" || locale === "lv") return locale;
  return "lv";
}

type EmailValidityEvent = { currentTarget: HTMLInputElement };

/** `lang` + native bubble handlers. onChange paliek formas stāvoklim. */
export function localizedEmailInputProps(locale: string, message: string) {
  const apply = (event: EmailValidityEvent) => {
    applyLocalizedEmailValidity(event.currentTarget, message);
  };
  return {
    lang: emailValidityLang(locale),
    onInvalid: apply,
    onInput: apply,
  };
}
