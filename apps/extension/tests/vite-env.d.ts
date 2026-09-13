/** Les pages enregistrées et le popup sont importés comme texte brut par Vite (`?raw`). */
declare module '*.html?raw' {
  const contenu: string;
  export default contenu;
}
