// Roda antes de tudo (setupFiles): o app lê o endereço do Supabase do ambiente; nos testes vale um de mentira,
// só para "servidor configurado" ser verdadeiro. Nenhum teste chama a rede de verdade.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://teste.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_KEY ??= 'chave-de-teste';
