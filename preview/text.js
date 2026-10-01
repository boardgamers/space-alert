const choose = (pair, locale) => pair?.[locale === "fr" ? 0 : 1];
const zoneLabels = {
  red: ["Gauche", "Left"],
  white: ["Centre", "Center"],
  blue: ["Droite", "Right"],
};
export function zoneLabel(zone, locale) {
  return choose(zoneLabels[zone], locale) ?? zone;
}
const specials = {
  rocketeer: [
    [
      "Lance une roquette depuis toute station. À distance, une réparation ne peut pas achever une panne.",
      "Launch a rocket from any station. A remote repair cannot finish a malfunction.",
    ],
    [
      "En bas à droite : lance deux roquettes en un tir de force 5. Ailleurs : effectue C.",
      "Lower right: launch two rockets as a strength-5 shot. Elsewhere: perform C.",
    ],
  ],
  "data-analyst": [
    [
      "Entretient l’ordinateur à distance et rapporte 1 point.",
      "Maintain the computer remotely and gain 1 point.",
    ],
    [
      "Observation : compte comme trois équipiers. Ailleurs : effectue C.",
      "Visual confirmation counts as three crew members. Elsewhere: perform C.",
    ],
  ],
  "energy-technician": [
    [
      "Recharge le réacteur central avec une capsule, depuis toute station.",
      "Refuel the central reactor with one capsule from any station.",
    ],
    [
      "Sur le pont supérieur : bouclier temporaire de 2 dans votre zone, 1 dans les autres, pour ce tour.",
      "Upper deck: temporary shields of 2 in your zone and 1 elsewhere, for this turn.",
    ],
  ],
  "pulse-gunner": [
    [
      "Tire avec le laser local et l’impulsion, si les deux peuvent fonctionner. Au canon à impulsion : tir normal.",
      "Fire the local laser and pulse cannon if both can operate. At the pulse station: normal fire.",
    ],
    [
      "Impulsion : force 2 dans sa portée normale, force 1 une portée plus loin. Ailleurs : effectue A.",
      "Pulse: strength 2 in normal range, strength 1 one range farther. Elsewhere: perform A.",
    ],
  ],
  medic: [
    [
      "Avant le capitaine : rend héroïque le premier A, B ou combat de chacun dans votre station ce tour. Peut accompagner un déplacement simple.",
      "Before the captain: enhance the first A, B or battlebot action of crew in your station this turn. May accompany one movement.",
    ],
    [
      "Avant le capitaine : personne avec vous ne peut être assommé ce tour ; −1 point. La protection vous suit. Peut accompagner un déplacement simple.",
      "Before the captain: nobody with you can be knocked out this turn; −1 point. Protection follows you. May accompany one movement.",
    ],
  ],
  teleporter: [
    [
      "Téléporte l’équipier au jeton départ auprès de celui au jeton arrivée. Choisissez les jetons pendant un transfert de données.",
      "Teleport the departure-token crew member to the arrival-token crew member. Assign tokens during data transfer.",
    ],
    [
      "Depuis une zone latérale : téléporte vers la zone opposée, sur l’autre pont.",
      "From a side zone: teleport to the opposite zone on the other deck.",
    ],
  ],
  hypernavigator: [
    [
      "Sur le pont inférieur : toutes les menaces avancent d’une case de moins ce tour.",
      "Lower deck: all threats move one fewer space this turn.",
    ],
    [
      "En bas au centre, au tour 10 ou 11 : termine ce tour puis passe au dernier tour sans actions d’équipage.",
      "Lower center on turn 10 or 11: finish this turn, then skip to the final turn without crew actions.",
    ],
  ],
  "special-ops": [
    [
      "Prépare votre prochain A, B ou combat : il sera héroïque.",
      "Prepare your next A, B or battlebot action: it becomes heroic.",
    ],
    [
      "À combiner avec une autre carte : protège son exécution contre les retards directs, obstacles et effets subis pendant l’action.",
      "Combine with another card: protect its execution from direct delays, obstacles and effects against you during the action.",
    ],
  ],
  "squad-leader": [
    [
      "Robots actifs : répare un dégât dans votre zone, priorité aux armes. Robots désactivés : les réactive.",
      "Active battlebots repair one damage in your zone, prioritizing weapons. Disabled battlebots are reactivated.",
    ],
    [
      "Avec des robots actifs, sauf en bas à droite : rejoint les intercepteurs et décolle. Déjà en vol : attaque héroïque.",
      "With active battlebots, except in lower right: reach the interceptors and launch. Already in space: heroic attack.",
    ],
  ],
  mechanic: [
    [
      "Prépare l’arme locale : +1 force au prochain tir de laser, ou +1 portée pour l’impulsion.",
      "Prepare the local weapon: +1 strength on its next laser shot, or +1 range for pulse.",
    ],
    [
      "Répare une panne A, B ou C de votre station de 2 points, priorité au plus petit numéro de menace.",
      "Repair a local A, B or C malfunction by 2, prioritizing the lowest threat number.",
    ],
  ],
};
export function specialDescription(action, locale) {
  const [, name, tier] = action.split(":");
  return (
    choose(specials[name]?.[tier === "advanced" ? 1 : 0], locale) ?? action
  );
}
const traits = {
  stealth: [
    "Invisible jusqu’à X : les armes l’ignorent.",
    "Untargetable until X: weapons ignore it.",
  ],
  cryo: [
    "Le cryobouclier absorbe la première salve, quelle que soit sa force.",
    "Cryoshield absorbs the first volley regardless of strength.",
  ],
  pulseBreaksShield: [
    "Ignore ses boucliers si l’impulsion le touche ce tour.",
    "Ignore its shields when pulse targets it this turn.",
  ],
  noRockets: [
    "Les roquettes ignorent cette menace.",
    "Rockets ignore this threat.",
  ],
  rocketImmune: [
    "Attire les roquettes mais ne subit pas leurs dégâts.",
    "Rockets can target it but deal no damage.",
  ],
  noHeavy: [
    "Les lasers lourds ignorent cette menace.",
    "Heavy lasers ignore this threat.",
  ],
  rocketMagnet: [
    "Attire toutes les roquettes, même hors portée ; +1 bouclier après une roquette.",
    "All rockets target it, even outside range; +1 shield after a rocket.",
  ],
  behemoth: [
    "Seule cible des intercepteurs : force 9, mais pilote assommé et robots désactivés.",
    "Lone interceptor target: strength 9, but the pilot is knocked out and battlebots disabled.",
  ],
  retaliates: [
    "Après avoir reçu un dégât, attaque 1 sur chaque zone à la fin du calcul des dégâts.",
    "After receiving damage, attack 1 on each zone at the end of damage calculation.",
  ],
  deathSplash: [
    "Détruite : inflige 1 dégât à toutes les autres menaces externes, sans bouclier.",
    "Destroyed: deals 1 damage to every other external threat, ignoring shields.",
  ],
  returnsFire: [
    "Riposte : désactive les robots qui l’attaquent, sauf attaque héroïque.",
    "Returns fire: disables attacking battlebots unless their attack is heroic.",
  ],
  grows: [
    "Après X, désactive les robots qui l’attaquent, sauf attaque héroïque.",
    "After X, disables attacking battlebots unless their attack is heroic.",
  ],
  rocketHp: [
    "Autant de points de vie que de roquettes restantes à son apparition.",
    "Hit points equal the rockets remaining when it appears.",
  ],
  deathKnockout: [
    "Réparation terminée : assomme les équipiers en bas dans les zones latérales.",
    "Final repair knocks out crew in lower left and lower right.",
  ],
  deathKnocksAttacker: [
    "Détruite : assomme son attaquant et désactive ses robots, même avec une attaque héroïque.",
    "Destroyed: knocks out its attacker and disables battlebots, even after a heroic attack.",
  ],
  removeTokenOnHit: [
    "Chaque combat nettoie une station. La troisième station nettoyée nettoie aussi la dernière.",
    "Each battlebot attack clears a station. Clearing the third also clears the last.",
  ],
  slime: [
    "Entrer retarde l’action suivante. Original : 2 vies ; chaque rejeton : 1 vie.",
    "Entering delays the next action. Original: 2 hit points; each progeny: 1.",
  ],
  rocketDeflects: [
    "Une roquette la dévie : elle ne fera pas son attaque Z.",
    "A rocket sends it off course: it will not perform its Z attack.",
  ],
  megashield: [
    "Chaque tour où elle est ciblée, perd 1 bouclier après les tirs.",
    "Each turn it is targeted, loses 1 shield after damage.",
  ],
};
Object.assign(traits, {
  phasing: [
    "Alterne visible / déphasée. Déphasée : ne peut être touchée et utilise les effets entre crochets.",
    "Alternates visible / phased out. While phased out, cannot be hit and uses bracketed effects.",
  ],
  polarized: [
    "Additionne les lasers, divise leur force par deux (arrondi supérieur), puis ajoute les autres armes avant les boucliers.",
    "Add laser strength and halve it, rounding up; add other weapons before shields.",
  ],
  spans: [
    "Les lasers des trois zones peuvent la cibler. Une arme ne la touche qu’une fois par tour.",
    "Lasers in all three zones can target it. Each weapon only hits it once per turn.",
  ],
  web: [
    "Ne dépasse pas Z. Si elle existe encore au saut, exécute son attaque Z.",
    "Stops at Z. If still present at the jump, performs its Z attack.",
  ],
  accelerates: [
    "Gagne 1 vitesse après chaque étape d’action des menaces.",
    "Gains 1 speed after each Threat Actions step.",
  ],
  slowsWhenHit: [
    "Vitesse 2 pour ce tour si les tirs lui infligent des dégâts ; sinon vitesse 4.",
    "Speed 2 this turn if weapon fire deals damage; otherwise speed 4.",
  ],
  energyHeal: [
    "L’énergie absorbée par les boucliers du vaisseau pendant ses attaques lui rend autant de vies.",
    "Energy absorbed by ship shields during its attacks heals it by that amount.",
  ],
  finishEnergy: [
    "La dernière réparation consomme 1 énergie du réacteur local ; impossible si ce réacteur est vide.",
    "The final repair consumes 1 local reactor energy; it cannot finish with an empty reactor.",
  ],
  parityStation: [
    "Station initiale : haut à gauche sur un numéro impair, haut à droite sur un numéro pair.",
    "Starts in upper left on an odd threat number, upper right on an even number.",
  ],
  shortCircuit: [
    "Bloque l’impulsion. Chaque tir du laser lourd central provoque une attaque 1 sur chaque zone.",
    "Blocks pulse. Every central heavy-laser shot triggers an attack 1 on every zone.",
  ],
  poison: [
    "Dès son apparition, le Ninja empoisonne les mouvements commençant ou finissant en haut à droite ou bas au centre. Après sa destruction, seuls les déjà empoisonnés restent menacés jusqu’à Z.",
    "From appearance, Ninja poisons movements starting or ending in upper right or lower center. After destruction, only already-poisoned crew remain threatened until Z.",
  ],
  infection: [
    "Les infections déjà transmises restent actives jusqu’à Z, même après sa destruction.",
    "Existing infections persist until Z, even after its destruction.",
  ],
  swapDeckOnHit: [
    "Chaque action qui l’endommage échange le pont des équipiers à bord.",
    "Whenever damaged, all crew aboard change decks.",
  ],
  vortex: [
    "À Z, une menace interne commune surprise résout toutes ses actions.",
    "At Z, a surprise common internal threat resolves all its actions.",
  ],
  teleportsOnHit: [
    "Après un dégât, se téléporte en haut à gauche.",
    "After taking damage, teleports to upper left.",
  ],
  gremlin: [
    "Si non détruit avant le saut, assomme tout l’équipage. Les systèmes sabotés se réparent séparément.",
    "If not destroyed before the jump, knocks out all crew. Sabotaged systems are repaired separately.",
  ],
  parasite: [
    "S’attache au premier équipier qui se déplace, puis le suit. Seul un autre équipier peut le combattre. L’hôte est assommé à sa destruction ; s’il est assommé avant, la menace survit.",
    "Attaches to the first crew member who moves, then follows them. Only another crew member can attack it. Destroying it knocks out its host; if the host is knocked out earlier, the threat survives.",
  ],
});
export function traitDescriptions(th, locale) {
  const result = Object.entries(traits)
    .filter(([key]) => th[key])
    .map(([, v]) => choose(v, locale));
  const t = (fr, en) => (locale === "fr" ? fr : en);
  if (th.maxTargetRange)
    result.push(
      t(
        `Ciblable uniquement à portée ${th.maxTargetRange} ou moins.`,
        `Targetable only at range ${th.maxTargetRange} or less.`,
      ),
    );
  if (th.damageCap)
    result.push(
      t(
        `Au plus ${th.damageCap} dégât(s) de tirs par tour.`,
        `At most ${th.damageCap} weapon damage per turn.`,
      ),
    );
  if (th.asteroid)
    result.push(
      t(
        `Détruit : attaque de force ${th.asteroid} par X/Y déjà franchi.`,
        `Destroyed: attack strength ${th.asteroid} per X/Y already crossed.`,
      ),
    );
  if (th.simultaneousRepairs)
    result.push(
      t(
        `Nécessite ${th.simultaneousRepairs} réparateurs différents au même tour.`,
        `Requires ${th.simultaneousRepairs} different repairers in the same turn.`,
      ),
    );
  if (th.multiRepairBonus)
    result.push(
      t(
        `+${th.multiRepairBonus} réparation si toutes ses stations sont réparées au même tour.`,
        `+${th.multiRepairBonus} repair if all its stations are repaired in the same turn.`,
      ),
    );
  if (th.carrier)
    result.push(
      t(
        `Intercepteurs à sa portée ou plus près : ses attaques perdent ${th.carrier} force.`,
        `Interceptors in its range or closer reduce its attacks by ${th.carrier}.`,
      ),
    );
  if (th.inaccessibility)
    result.push(
      t(
        `Absorbe les ${th.inaccessibility} premiers dégâts de chaque tour.`,
        `Absorbs the first ${th.inaccessibility} damage each turn.`,
      ),
    );
  if (th.loneRepair)
    result.push(
      t(
        `Un seul réparateur ce tour : +${th.loneRepair} réparation.`,
        `Exactly one repairer this turn: +${th.loneRepair} repair.`,
      ),
    );
  if (th.botsRepairBonus)
    result.push(
      t(
        `Avec des robots actifs : +${th.botsRepairBonus} réparation.`,
        `With active battlebots: +${th.botsRepairBonus} repair.`,
      ),
    );
  return result;
}
const dictionary = {
  red: ["gauche", "left"],
  white: ["centre", "center"],
  blue: ["droite", "right"],
  shield: ["bouclier", "shield"],
  reactor: ["réacteur", "reactor"],
  speed: ["vitesse", "speed"],
  fragments: ["fragments", "fragments"],
  half: [
    "la moitié des dégâts, arrondie vers le bas",
    "half the damage, rounded down",
  ],
  hp: ["vies restantes", "remaining hit points"],
  "double-hp": ["2 × vies restantes", "2 × remaining hit points"],
  "triple-hp": ["3 × vies restantes", "3 × remaining hit points"],
  crew: ["équipiers présents", "crew present"],
  all: ["toutes zones", "all zones"],
  other: ["autres zones", "other zones"],
  lateral: ["zones latérales", "side zones"],
  occupied: ["chaque zone occupée", "each occupied zone"],
  stations: ["chaque station occupée", "each occupied station"],
  station: ["dans ses stations", "in its stations"],
  zone: ["dans sa zone", "in its zone"],
  "active-bots": ["menant des robots actifs", "leading active battlebots"],
  "without-bots": [
    "dans sa station sans robots actifs",
    "in its station without active battlebots",
  ],
  "except-bridge": ["hors de la passerelle", "outside the bridge"],
  lift: ["change de pont", "change deck"],
  double: ["dégâts doublés après bouclier", "double damage after shields"],
  plasma: [
    "plasma : assomme si aucun dégât absorbé",
    "plasma: knockout if no damage absorbed",
  ],
  "ignore-shield": ["ignore les boucliers", "ignore shields"],
  revealed: ["devient ciblable", "becomes targetable"],
  grown: ["croît : riposte activée", "grows: returns fire"],
  "attack-aura": [
    "+1 attaque aux autres menaces externes jusqu’à sa destruction",
    "+1 attack to other external threats until destroyed",
  ],
  "shield-aura": [
    "+1 bouclier à toutes les menaces externes jusqu’à sa destruction",
    "+1 shield to all external threats until destroyed",
  ],
  "double-red": [
    "double les dégâts à la zone de gauche",
    "double damage to left zone",
  ],
  "double-all": [
    "double les dégâts à toutes les zones",
    "double damage to all zones",
  ],
  "lethal-entry": [
    "entrer dans une station contaminée assomme",
    "entering a contaminated station causes knockout",
  ],
  "already-fired": ["arme déjà utilisée", "weapon already fired"],
  "no-energy": ["réacteur vide", "empty reactor"],
  "no-fuel": ["plus de combustible", "no fuel"],
  "irreparable-system": [
    "système irréparable ou dernière réparation à distance impossible",
    "system irreparable or remote final repair prohibited",
  ],
  "rocket-unavailable": [
    "roquette indisponible ou déjà lancée ce tour",
    "no rocket available or already launched this turn",
  ],
  "linked-weapons-unavailable": [
    "les deux armes ne peuvent pas tirer ensemble",
    "both linked weapons cannot fire",
  ],
  "ultrafast-return": ["retour ultrarapide", "ultrafast return"],
  "upper-weapon": ["arme supérieure", "upper weapon"],
  "lower-weapon": ["arme inférieure", "lower weapon"],
  structure: ["structure", "structure"],
};
Object.assign(dictionary, {
  inaccessibility: ["inaccessibilité", "inaccessibility"],
  direct: ["dégâts directs", "direct damage"],
  shielded: ["boucliers applicables", "shields apply"],
  "reactor+1": ["énergie du réacteur + 1", "reactor energy + 1"],
  alone: ["seuls dans leur station", "alone in their station"],
  group: [
    "au moins deux dans leur station",
    "sharing their station with another crew member",
  ],
  "reverse-shields": [
    "les prochains tirs absorbent l’énergie des boucliers et l’ajoutent aux dégâts",
    "subsequent attacks drain shields and add that energy to damage",
  ],
  "ignore-shields": [
    "les prochains tirs ignorent les boucliers",
    "subsequent attacks ignore shields",
  ],
  "poison-entry": [
    "empoisonne ceux qui commencent ou terminent un déplacement en haut à droite ou bas au centre",
    "poisons crew starting or ending a movement in upper right or lower center",
  ],
  "sealed-red": [
    "portes vers la zone de gauche scellées",
    "doors to left zone sealed",
  ],
  "sealed-blue": [
    "portes vers la zone de droite scellées",
    "doors to right zone sealed",
  ],
  "sealed-door": ["porte scellée", "sealed door"],
  "cyber-gremlin": [
    "Cyber Gremlin encore présent au saut",
    "Cyber Gremlin still present at jump",
  ],
});
function word(x, locale) {
  return choose(dictionary[x], locale) ?? String(x ?? "");
}
export function stationLabel(x, locale) {
  if (x && typeof x === "object" && x.zone && x.deck) x = `${x.zone}-${x.deck}`;
  if (typeof x !== "string" || !/^(red|white|blue)-(upper|lower)$/.test(x))
    return "";
  const [z, d] = x.split("-");
  return `${zoneLabel(z, locale)} ${d === "upper" ? "↑" : "↓"}`;
}
export function effectDescription(e, locale) {
  const t = (fr, en) => (locale === "fr" ? fr : en),
    w = (x) => word(x, locale);
  let text;
  switch (e.type) {
    case "attack":
      text = `${t("Attaque", "Attack")} ${w(e.amount)}${e.zones && e.zones !== "own" ? " · " + w(e.zones) : ""}${e.mode && e.mode !== "normal" ? " · " + w(e.mode) : ""}`;
      break;
    case "heal":
      text = `${t("Répare", "Heal")} ${w(e.amount)}`;
      break;
    case "change":
      text = `${w(e.stat)} ${e.amount >= 0 ? "+" : ""}${e.amount}`;
      break;
    case "set":
      text = `${w(e.stat)} = ${e.amount}`;
      break;
    case "flag":
      text = w(e.name);
      break;
    case "drain":
      text = `${t("Retire", "Drain")} ${e.amount ?? t("toute l’énergie", "all energy")} · ${w(e.system)}${e.zones ? " · " + w(e.zones) : ""}`;
      break;
    case "move":
      text = `${t("Se déplace", "Move")} ${w(e.direction)}`;
      break;
    case "drain-or-damage":
      text = t(
        "Retire 1 énergie du réacteur, ou inflige 1 dégât s’il est vide.",
        "Drain 1 reactor energy, or deal 1 damage if it is empty.",
      );
      break;
    case "knockout":
      text = `${t("Assomme les équipiers", "Knock out crew")} ${w(e.scope)}`;
      break;
    case "delay":
      text = `${t("Retarde les équipiers", "Delay crew")} ${w(e.scope)}`;
      break;
    case "slime-spread":
      text = t(
        "Chaque Slime se propage d’une station vers le côté opposé.",
        "Each Slime spreads one station toward the opposite side.",
      );
      break;
    case "remove-rocket":
      text = t(
        "Détruit une roquette en réserve.",
        "Destroy one stored rocket.",
      );
      break;
    case "disable-stored-bots":
      text = t(
        "Désactive les robots en réserve en bas à gauche.",
        "Disable stored battlebots in lower left.",
      );
      break;
    case "fuel-lost":
      text = t(
        "Détruit une capsule de combustible.",
        "Destroy one fuel capsule.",
      );
      break;
    case "self-damage":
      text = t(`Reçoit ${e.amount} dégât(s).`, `Take ${e.amount} damage.`);
      break;
    case "seek":
      text = t(
        "Va dans la station adjacente avec le plus d’équipiers ; ne bouge pas en cas d’égalité.",
        "Move to the adjacent station with most crew; stay on a tie.",
      );
      break;
    case "advance-others":
      if (e.position === "internal") {
        text = t(
          "Avance les autres menaces internes d’une case, avec les effets franchis.",
          "Advance other internal threats one space, executing crossed effects.",
        );
        break;
      }
      text = t(
        "Avance les autres menaces externes d’une case, en exécutant les effets franchis.",
        "Advance other external threats one space, executing crossed effects.",
      );
      break;
    case "destroy-ship":
      text = t("Détruit le vaisseau.", "Destroy the ship.");
      break;
    case "fill-shield":
      text = t(
        "Remplit son bouclier depuis son réacteur.",
        "Fill its shield from its reactor.",
      );
      break;
    case "leak":
      text = t(
        `Vide ${w(e.system)} et inflige autant de dégâts${e.zones ? " · " + w(e.zones) : ""}.`,
        `Empty ${w(e.system)} and deal that much damage${e.zones ? " · " + w(e.zones) : ""}.`,
      );
      break;
    case "jump":
      text = t(
        `Saute vers la trajectoire à ${e.direction === "left" ? "gauche" : "droite"}, à distance égale (sans place : reste).`,
        `Jump to the ${e.direction} trajectory at the same distance, if space exists.`,
      );
      break;
    case "call":
      text = t(
        `Fait apparaître son renfort ${e.position === "internal" ? "interne" : "externe"}${e.zone && e.zone !== "internal" ? " · " + (e.zone === "own" ? "même zone" : w(e.zone)) : ""}.`,
        `Spawn the assigned ${e.position} reinforcement${e.zone && e.zone !== "internal" ? " · " + (e.zone === "own" ? "same zone" : w(e.zone)) : ""}.`,
      );
      if (e.undamagedSpeed)
        text += t(
          " Moins de 2 dégâts : vitesse du renfort +1.",
          "If fewer than 2 damage: reinforcement speed +1.",
        );
      break;
    case "heal-others":
      text = t(
        `Répare ${e.amount} dégât de toutes les menaces ${e.position === "internal" ? "internes" : "externes"}.`,
        `Heal ${e.amount} damage from all ${e.position} threats.`,
      );
      break;
    case "knockout-delay":
      text = t(
        "Assomme les équipiers menant des robots actifs ; retarde les autres.",
        "Knock out crew leading active battlebots; delay the rest.",
      );
      break;
    case "advance-zone":
      text = t(
        `Avance les menaces de la zone ${w(e.zone)} de ${e.amount} cases, avec les effets franchis.`,
        `Advance ${w(e.zone)} zone threats by ${e.amount}, executing crossed effects.`,
      );
      break;
    case "opposite-damage":
      text = t(
        `Inflige ${e.amount} dégât à l’autre zone latérale.`,
        `Deal ${e.amount} damage to the opposite side zone.`,
      );
      break;
    case "short-circuit":
      text = t(
        `Consomme 1 ${e.resource === "fuel" ? "capsule" : "énergie centrale"} pour attaquer chaque zone de force 1.`,
        `Consume 1 ${e.resource === "fuel" ? "fuel capsule" : "central reactor energy"} to attack each zone for 1.`,
      );
      break;
    case "drill-move":
      text = t(
        "Avance d’une station vers la zone la plus endommagée ; égalité : vers le centre.",
        "Move one station toward the most damaged zone; ties: toward the center.",
      );
      break;
    case "shambler":
      text = t(
        "Avec un équipier : 2 dégâts à la zone. Sinon : récupère 1 vie.",
        "Crew present: deal 2 zone damage. Otherwise heal 1.",
      );
      break;
    case "blind":
      text = t(
        `Obstrue la visée ${e.zone === "lateral" ? "d’une zone latérale" : "du centre"}. Observation ou intercepteurs requis pour y tirer au laser.`,
        `Obscure ${e.zone === "lateral" ? "a side zone" : "center"} targeting. Visual confirmation or interceptors are required for laser fire there.`,
      );
      break;
    case "mine":
      text = t(
        "Pose une mine dans sa station.",
        "Place a mine in its station.",
      );
      break;
    case "detonate-mines":
      text = t(
        "Chaque mine inflige 2 dégâts à sa zone.",
        "Each mine deals 2 damage to its zone.",
      );
      break;
    case "infect":
      text = t(
        "Infecte tous les équipiers de sa station.",
        "Infect all crew in its station.",
      );
      break;
    case "infection-detonate":
      text = t(
        "Chaque infecté conscient à bord inflige 2 dégâts à sa zone.",
        "Each conscious infected crew member aboard deals 2 damage to their zone.",
      );
      break;
    case "poison-detonate":
      text = t(
        "Assomme les empoisonnés. Si le Ninja vit encore : chaque roquette restante provoque une attaque 2 à gauche, puis est détruite.",
        "Knock out poisoned crew. If Ninja is still alive, each remaining rocket causes an attack 2 on the left, then is destroyed.",
      );
      break;
    case "repeat-action":
      text = t(
        "Répète les actions du tour courant au prochain tour, en décalant les programmes.",
        "Repeat this turn’s actions next turn, delaying the programs.",
      );
      break;
    case "swap-zones":
      text = t(
        "Les équipiers en zones latérales échangent gauche / droite, sans changer de pont.",
        "Crew in side zones swap left / right without changing deck.",
      );
      break;
    case "vortex-draw":
      text = t(
        "Révèle la menace surprise ; résout son apparition puis X, Y et Z.",
        "Reveal the surprise threat; resolve its appearance, X, Y and Z.",
      );
      break;
    case "absorb-reactor":
      text = t(
        "Vide le réacteur local et gagne autant de vitesse.",
        "Empty the local reactor and gain that much speed.",
      );
      break;
    case "sabotage":
      text = t(
        "Sabote les systèmes A, B et C de sa station ; chacun nécessite une réparation.",
        "Sabotage A, B and C in its station; each needs one repair.",
      );
      break;
    case "parasite-drain":
      text = t(
        "Retire 1 énergie du système B de la station de l’hôte.",
        "Drain 1 energy from the host station’s B system.",
      );
      break;
    case "parasite-knockout":
      text = t(
        "Assomme les autres équipiers avec l’hôte.",
        "Knock out other crew sharing the host’s station.",
      );
      break;
    case "parasite-attack":
      text = t(
        "5 dégâts directs dans la zone de l’hôte ; hôte en vol : attaque 5 au centre.",
        "5 direct damage to the host’s zone; host in space: attack 5 in the center.",
      );
      break;
    default:
      text = e.type;
  }
  if (e.phasedAmount !== undefined)
    text += t(
      ` [déphasée : ${e.phasedAmount}]`,
      ` [phased out: ${e.phasedAmount}]`,
    );
  if (e.phasedDirection)
    text += t(
      ` [déphasée : ${w(e.phasedDirection)}]`,
      ` [phased out: ${w(e.phasedDirection)}]`,
    );
  if (e.onlyPhasedIn)
    text += t(" (uniquement visible)", " (only when visible)");
  if (e.ifCrew)
    text += t(" (si un équipier est présent)", " (if crew is present)");
  if (e.ifDamaged) text += t(" (si endommagée)", " (if damaged)");
  if (e.ifUndamaged) text += t(" (si intacte)", " (if undamaged)");
  if (e.belowDamage !== undefined)
    text += t(
      ` (si moins de ${e.belowDamage} dégâts)`,
      ` (if fewer than ${e.belowDamage} damage)`,
    );
  if (e.unlessFlag) text += t(" (sauf si déviée)", " (unless off course)");
  return text;
}
export function eventDescription(e, locale, threats) {
  const t = (fr, en) => (locale === "fr" ? fr : en),
    w = (x) => word(x, locale);
  const prefix =
    e.crew !== undefined ? `${t("Équipier", "Crew")} ${e.crew + 1} · ` : "";
  const found = threats.find((t) => t.instance === e.threat);
  const threat = found?.card?.name ?? found?.name ?? e.threat;
  const messages = {
    "threat-called": t("Renfort appelé", "Reinforcement called"),
    "threat-jump": t(
      `Change de trajectoire → ${w(e.zone)}`,
      `Change trajectory → ${w(e.zone)}`,
    ),
    "parasite-attached": t("Parasite attaché", "Parasite attached"),
    "threat-appears": t("Menace détectée", "Threat appears"),
    "threat-destroyed": t("Menace détruite", "Threat destroyed"),
    "threat-survived": t("Menace échappée", "Threat survived"),
    "threat-action": t(`Action ${e.mark}`, `Action ${e.mark}`),
    "threat-hit": t(
      `${e.damage} dégât(s), après ${e.shield} bouclier(s)`,
      `${e.damage} damage after ${e.shield} shields`,
    ),
    "cryoshield-broken": t("Cryobouclier détruit", "Cryoshield broken"),
    move: t(
      `${stationLabel(e.from, locale)} → ${stationLabel(e.to, locale)}`,
      `${stationLabel(e.from, locale)} → ${stationLabel(e.to, locale)}`,
    ),
    teleport: t(
      `Téléportation → ${stationLabel(e.to, locale)}`,
      `Teleport → ${stationLabel(e.to, locale)}`,
    ),
    fire: t(
      `Tir ${stationLabel(e.station, locale)}, force ${e.strength}, portée ${e.range}`,
      `Fire ${stationLabel(e.station, locale)}, strength ${e.strength}, range ${e.range}`,
    ),
    energy: t(
      `Transfert de ${e.amount} énergie · ${stationLabel(e.station, locale)} · ${w(e.system)}`,
      `Transfer ${e.amount} energy · ${stationLabel(e.station, locale)} · ${w(e.system)}`,
    ),
    computer: t(
      `Ordinateur entretenu · phase ${e.phase}`,
      `Computer maintained · phase ${e.phase}`,
    ),
    "computer-missed": t(
      `Ordinateur oublié · phase ${e.phase}`,
      `Computer missed · phase ${e.phase}`,
    ),
    "rocket-launched": t(
      `${e.count} roquette(s) lancée(s)`,
      `${e.count} rocket(s) launched`,
    ),
    "launch-interceptors": t(
      "Décollage des intercepteurs",
      "Interceptor launch",
    ),
    "bots-activated": t("Robots activés", "Battlebots activated"),
    "bots-reactivated": t("Robots réactivés", "Battlebots reactivated"),
    "battlebots-hit": t(
      `Attaque des robots : ${e.amount ?? 1} dégât(s)`,
      `Battlebot attack: ${e.amount ?? 1} damage`,
    ),
    repair: t(`Répare ${e.amount} dégât(s)`, `Repair ${e.amount} damage`),
    "repair-attempt": t(
      "Réparation simultanée tentée",
      "Simultaneous repair attempted",
    ),
    "hull-repaired": t(
      `Répare ${w(e.tile)} · ${w(e.zone)}`,
      `Repair ${w(e.tile)} · ${w(e.zone)}`,
    ),
    delay: t(
      `Programme décalé à partir de T+${e.from}${e.dropped ? " ; dernière action perdue" : ""}`,
      `Program delayed from T+${e.from}${e.dropped ? "; final action lost" : ""}`,
    ),
    "knocked-out": t(
      `Assommé · ${w(e.reason)}`,
      `Knocked out · ${w(e.reason)}`,
    ),
    ineffective: t(`Sans effet · ${w(e.reason)}`, `No effect · ${w(e.reason)}`),
    "ship-damage": t(
      `Dégât ${w(e.zone)} · ${w(e.tile)}`,
      `Damage ${w(e.zone)} · ${w(e.tile)}`,
    ),
    "ship-destroyed": t("Vaisseau détruit", "Ship destroyed"),
    attack: t(
      `Attaque ${w(e.zone)} : ${e.absorbed} absorbé(s), ${e.damage} restant(s)`,
      `Attack ${w(e.zone)}: ${e.absorbed} absorbed, ${e.damage} remaining`,
    ),
    specialization: specialDescription(`special:${e.name}:${e.tier}`, locale),
  };
  return (
    prefix +
    (messages[e.type] ?? e.type) +
    (threat !== undefined ? " · " + threat : "")
  );
}
