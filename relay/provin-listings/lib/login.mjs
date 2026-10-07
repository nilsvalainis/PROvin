/**
 * Automātiska ielogošanās ar env paroli. Ja parādās captcha vai e-pasta / 2FA kods,
 * NEmēģina apiet: atgriež `login_required`, lai Nils ielogojas manuāli (noVNC).
 * Paroles nekad nenonāk logos vai atbildēs.
 */
import { hasCaptchaOrChallenge, looksLikeTwoFactor, pageText, randomPause } from "./browser.mjs";

const USER_SELECTOR =
  'input[type="email"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[id*="user" i], input[id*="email" i], input[id*="login" i]';
const PASS_SELECTOR = 'input[type="password"]';
const SUBMIT_SELECTOR =
  'button[type="submit"], input[type="submit"], button[name*="login" i], button[id*="login" i], button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in"), button:has-text("Anmelden")';
const REMEMBER_SELECTOR =
  'input[type="checkbox"][name*="remember" i], input[type="checkbox"][id*="remember" i], input[type="checkbox"][name*="persist" i], input[type="checkbox"][name*="stay" i]';

async function firstVisible(page, selector, timeoutMs) {
  const loc = page.locator(selector).first();
  try {
    await loc.waitFor({ state: "visible", timeout: timeoutMs });
    return loc;
  } catch {
    return null;
  }
}

/** OneTrust banneris aizsedz lauku un locator.click beidzas ar timeout. */
export async function dismissCookieBanner(page) {
  const banner = page.locator("#onetrust-banner-sdk");
  const visible = await banner.isVisible().catch(() => false);
  if (!visible) {
    try {
      await banner.waitFor({ state: "visible", timeout: 2_500 });
    } catch {
      return;
    }
  }
  const reject = page.locator("#onetrust-reject-all-handler");
  const accept = page.locator("#onetrust-accept-btn-handler");
  const btn = (await reject.isVisible().catch(() => false)) ? reject : accept;
  if (!(await btn.isVisible().catch(() => false))) return;
  await btn.click({ timeout: 5_000 }).catch(() => undefined);
  await banner.waitFor({ state: "hidden", timeout: 4_000 }).catch(() => undefined);
  await randomPause(200, 500);
}

export async function tickRemember(page) {
  const named = page.getByRole("checkbox", { name: /remember|stay signed|angemeldet|bleiben|onthoud|ingelogd/i }).first();
  const css = page.locator(REMEMBER_SELECTOR).first();
  const box = (await named.count().catch(() => 0)) > 0 ? named : css;
  if ((await box.count().catch(() => 0)) === 0) return;
  try {
    if (!(await box.isChecked())) await box.check({ force: true, timeout: 2_000 });
  } catch {
    /* nav kritiski */
  }
}

/**
 * @returns {Promise<{ok: boolean, status: "ok"|"login_required"|"error", note: string}>}
 */
export async function autoLogin(page, { loginUrl, username, password, isLoggedIn, platformLabel, userSelector, passSelector, submitSelector }) {
  if (!username || !password) return { ok: false, status: "login_required", note: `${platformLabel}: nav lietotāja / paroles env.` };
  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await randomPause(900, 1_800);
    await dismissCookieBanner(page);

    const challenge = await hasCaptchaOrChallenge(page);
    if (challenge) return { ok: false, status: "login_required", note: `${platformLabel}: login lapā ${challenge}; jāielogojas manuāli.` };

    /** Dažas OAuth lapas prasa vispirms e-pastu, tad atsevišķā solī paroli. */
    const userField = await firstVisible(page, userSelector || USER_SELECTOR, 12_000);
    if (!userField) {
      if (await isLoggedIn(page)) return { ok: true, status: "ok", note: "jau ielogots" };
      return { ok: false, status: "error", note: `${platformLabel}: nav atrasts lietotāja lauks (${page.url().slice(0, 80)}).` };
    }
    await userField.click();
    await userField.fill(username);
    await randomPause(300, 800);

    let passField = await firstVisible(page, passSelector || PASS_SELECTOR, 2_500);
    if (!passField) {
      const next = await firstVisible(page, submitSelector || SUBMIT_SELECTOR, 2_000);
      if (next) {
        await next.click();
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
        await randomPause(900, 1_600);
      }
      passField = await firstVisible(page, passSelector || PASS_SELECTOR, 12_000);
    }
    if (!passField) return { ok: false, status: "error", note: `${platformLabel}: nav atrasts paroles lauks.` };
    await passField.click();
    await passField.fill(password);
    await randomPause(300, 800);

    await tickRemember(page);

    const submit = await firstVisible(page, submitSelector || SUBMIT_SELECTOR, 5_000);
    if (submit) await submit.click();
    else await passField.press("Enter");

    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    await randomPause(1_500, 3_000);

    const afterChallenge = await hasCaptchaOrChallenge(page);
    if (afterChallenge) return { ok: false, status: "login_required", note: `${platformLabel}: pēc login ${afterChallenge}; jāielogojas manuāli.` };
    const text = await pageText(page, 8_000);
    if (looksLikeTwoFactor(text)) return { ok: false, status: "login_required", note: `${platformLabel}: prasa e-pasta / 2FA kodu; jāielogojas manuāli.` };
    if (/(invalid|incorrect|wrong|falsch|ungültig|onjuist).{0,40}(password|credentials|login|passwort)/i.test(text)) {
      return { ok: false, status: "login_required", note: `${platformLabel}: parole noraidīta.` };
    }

    if (await isLoggedIn(page)) return { ok: true, status: "ok", note: "auto_login_ok" };
    return { ok: false, status: "login_required", note: `${platformLabel}: pēc login sesija joprojām nav aktīva (${page.url().slice(0, 80)}).` };
  } catch (e) {
    return { ok: false, status: "error", note: `${platformLabel}: login kļūda ${e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "nezināma"}` };
  }
}
