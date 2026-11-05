// Completa o app.json com o que não pode ficar no git.
// O google-services.json (avisos dos amigos pelo Firebase) fica fora do repositório; no EAS ele chega pela
// variável de arquivo GOOGLE_SERVICES_JSON, e no computador é o arquivo ao lado deste.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
