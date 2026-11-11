export function confirmedBriefConclusions(text: string): string[] {
  if (text.length > 8000) throw new Error('Las conclusiones confirmadas admiten hasta 8000 caracteres.');
  const lines = [...new Set(text.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
  if (lines.length > 20) throw new Error('Puedes confirmar hasta 20 conclusiones.');
  if (lines.some(line => line.length > 1000)) throw new Error('Cada conclusión admite hasta 1000 caracteres.');
  return lines;
}
