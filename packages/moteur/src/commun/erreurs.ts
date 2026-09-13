/** Erreur de base du moteur : toute erreur levée par le moteur en hérite. */
export class ErreurMoteur extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Une hypothèse est hors du domaine calculable (ex. différé plus long que le prêt). */
export class ErreurHypotheseInvalide extends ErreurMoteur {}

/** La version de règles demandée n'existe pas dans ce moteur. */
export class ErreurVersionRegles extends ErreurMoteur {}

/** Une résolution numérique n'a pas pu démarrer (pas de changement de signe). */
export class ErreurResolution extends ErreurMoteur {}
