import { notFound } from "next/navigation";

/** Nezināmi ceļi zem /[locale] → lokalizētais 404 (ar vietnes izkārtojumu), jo saknes app/layout vairs nav. */
export default function UnknownLocalePath() {
  notFound();
}
