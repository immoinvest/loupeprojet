// Better Auth accepte aussi une base Bun (`bun:sqlite`) : ses types importent ce module, absent sous
// Node. Déclaration minimale pour que le type des options ne devienne pas « error » ; jamais utilisé ici.
declare module 'bun:sqlite' {
  export interface Database {
    readonly moteur: 'bun:sqlite';
  }
}
