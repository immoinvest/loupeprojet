/** Les pages enregistrées et le popup sont importés comme texte brut par Vite (`?raw`). */
declare module '*.html?raw' {
  const contenu: string;
  export default contenu;
}

/** Le script de build, lu comme texte pour vérifier l'identifiant Firefox. */
declare module '*.ts?raw' {
  const contenu: string;
  export default contenu;
}
