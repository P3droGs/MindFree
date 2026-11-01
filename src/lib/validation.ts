/** Confere só o formato (algo@algo.algo); se o e-mail existe, quem diz é o servidor. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Força da senha de 0 (vazia) a 3 (forte), para a barrinha do cadastro. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (password.length === 0) return 0;
  if (password.length < 8) return 1;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  return password.length >= 12 || variety >= 3 ? 3 : 2;
}
