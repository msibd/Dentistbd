/** Shared formatting helpers used across the dashboard and print sheets. */

/** Up to two uppercase initials from a person's name. */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** BDT currency formatter (two fraction digits), shared by billing views. */
export const bdtCurrency = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});
