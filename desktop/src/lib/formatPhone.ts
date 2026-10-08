/** "+12345678901" -> "+1 (234) 567-8901"; other formats pass through untouched. */
export function formatPhone(phone: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : phone;
}
