import { describe, expect, it } from "vitest";
import {
  applyLocalizedEmailValidity,
  emailValidityLang,
  localizedEmailInputProps,
} from "./email-input-validity";

function fakeInput(flags: { typeMismatch?: boolean; valueMissing?: boolean; required?: boolean }) {
  let custom = "";
  return {
    required: Boolean(flags.required),
    validity: {
      typeMismatch: Boolean(flags.typeMismatch),
      valueMissing: Boolean(flags.valueMissing),
    },
    setCustomValidity(msg: string) {
      custom = msg;
    },
    get custom() {
      return custom;
    },
  };
}

describe("applyLocalizedEmailValidity", () => {
  it("sets the locale message on type mismatch", () => {
    const input = fakeInput({ typeMismatch: true });
    applyLocalizedEmailValidity(input as unknown as HTMLInputElement, "Please enter a valid email address.");
    expect(input.custom).toBe("Please enter a valid email address.");
  });

  it("clears the message when the value is valid", () => {
    const input = fakeInput({});
    applyLocalizedEmailValidity(input as unknown as HTMLInputElement, "Please enter a valid email address.");
    expect(input.custom).toBe("");
  });

  it("maps page locale to html lang for the native bubble", () => {
    expect(emailValidityLang("de")).toBe("de");
    expect(emailValidityLang("ru")).toBe("ru");
    expect(emailValidityLang("en")).toBe("en");
    expect(emailValidityLang("lv")).toBe("lv");
  });
});

describe("localizedEmailInputProps", () => {
  it("exposes lang and wires onInvalid to the locale message", () => {
    const props = localizedEmailInputProps("de", "Bitte geben Sie eine gültige E-Mail-Adresse ein.");
    expect(props.lang).toBe("de");
    const input = fakeInput({ typeMismatch: true });
    props.onInvalid({ currentTarget: input as unknown as HTMLInputElement });
    expect(input.custom).toBe("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
  });
});
