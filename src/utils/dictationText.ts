// Keep dictated chunks separated without altering existing content.
export function dictationText(text: string, before: string, after: string) {
  return `${before && !/\s$/.test(before) && !/^[.,;:!?]/.test(text) ? ' ' : ''}${text}${after && !/^[\s.,;:!?]/.test(after) ? ' ' : ''}`;
}
