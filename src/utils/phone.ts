// Nigerian local numbers default to +234; explicit international numbers retain their country code.
export function normalizePhone(value: string): string {
  const input = value.trim();
  if (!input) return '';
  if (!/^[+\d\s().-]+$/.test(input)) throw new Error('Enter a valid phone number.');
  let number = input.replace(/[\s().-]/g, '');
  if (number.startsWith('00')) number = '+' + number.slice(2);
  if (/^0[789]\d{9}$/.test(number)) number = '+234' + number.slice(1);
  else if (/^234[789]\d{9}$/.test(number)) number = '+' + number;
  if (!/^\+[1-9]\d{7,14}$/.test(number) || (number.startsWith('+234') && !/^\+234[789]\d{9}$/.test(number))) {
    throw new Error('Use a Nigerian mobile number such as 08012345678, or an international number starting with + and its country code.');
  }
  return number;
}
