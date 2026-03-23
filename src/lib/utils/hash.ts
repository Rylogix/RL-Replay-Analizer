const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const sha256Hex = async (input: ArrayBuffer) => {
  const digest = await crypto.subtle.digest('SHA-256', input);
  return toHex(digest);
};

