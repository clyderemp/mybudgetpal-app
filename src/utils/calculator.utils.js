const getRatioString = (a, b) => {
  const gcd = (x, y) => (y === 0 ? x : gcd(y, x % y));
  const divisor = gcd(a, b);
  return `${a / divisor}:${b / divisor}`;
};

export const useCalcUtils = { getRatioString };
