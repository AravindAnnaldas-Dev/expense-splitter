// Amounts are stored/transmitted as integer paise (1 rupee = 100 paise) to
// avoid floating point rounding — see server/src/routes/expenses.ts.
export function formatMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

export function toPaise(rupees: number) {
  return Math.round(rupees * 100);
}
