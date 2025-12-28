export function convertToCuneiform(num: number): string {
  num +=1; //Because our in-game props are 0 indexed
  if (num < 1 || num > 64) return "Out of range (1-64)";

  const map = {
    1: '𒐕', 2: '𒐖', 3: '𒐗', 4: '𒐘', 5: '𒐙',
    6: '𒐚', 7: '𒐛', 8: '𒐜', 9: '𒐞',
    10: '𒌋', 20: '⟪', 30: '𒌍', 40: '𒐏', 50: '𒐐', 60: '𒐑'
  };

  // Special case for 60-64 based on your specific request
  if (num >= 60) {
    let remainder = num - 60;
    return map[60] + (remainder > 0 ? map[remainder] : "");
  }

  // Logic for numbers 1-59
  let tens = Math.floor(num / 10) * 10;
  let ones = num % 10;

  let result = "";
  if (tens > 0) result += map[tens];
  if (ones > 0) result += map[ones];

  return result;
}