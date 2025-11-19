const fr = {
  languageNames: {
    fr: 'Français',
    en: 'Anglais',
    nl: 'Néerlandais',
  },
  common: {
    close: 'Fermer',
    loading: 'Chargement...',
    start_game: 'Lancer la partie !',
    review_mistakes: 'Réviser mes erreurs',
    help: 'Aide',
    profile: 'Mon Profil',
    home: 'Accueil',
    replay: 'Rejouer',
    score: 'Score',
    next_question: 'Question suivante',
    quit: 'Abandonner',
    hint: 'Indice',
    language_switcher_label: 'Changer de langue',
    scientific_preference_label: 'Prioriser le nom scientifique',
    scientific_preference_help: 'Utiliser le nom latin lorsque possible.',
    pack_description_label: 'À propos du pack',
  },
  nav: {
    help_label: 'Aide et informations',
    profile_label: 'Mon Profil',
    title_alt: 'Titre Inaturamouche',
    title_tooltip: 'Retour au menu principal',
  },
  home: {
    easy_mode: 'Facile',
    easy_mode_description: 'Mode facile : quatre propositions et indice facultatif.',
    hard_mode: 'Difficile',
    hard_mode_description: 'Mode difficile : devinez la taxonomie avec essais limités.',
  },
  configurator: {
    pack_label: 'Choisissez un pack de jeu :',
    pack_hint: 'Sélectionnez un pack thématique ou personnalisez votre partie.',
    pack_description_label: 'À propos du pack',
  },
  packs: {
    custom: {
      title: 'Filtre personnalisé',
      description: 'Créez votre propre quiz en sélectionnant ou excluant des taxons, un lieu et des dates.',
    },
    european_mushrooms: {
      title: "Champignons comestibles d'Europe",
      description: 'Une sélection des champignons les plus communs en Europe.',
    },
    european_trees: {
      title: "Arbres communs d'Europe",
      description: 'Une sélection des arbres les plus communs en Europe.',
    },
    world_birds: {
      title: 'Oiseaux du monde',
      description: "Les 100 espèces d'oiseaux les plus observées sur iNaturalist.",
    },
    france_mammals: {
      title: 'Mammifères de France',
      description: 'Toutes les observations de mammifères en France métropolitaine.',
    },
    belgium_herps: {
      title: 'Reptiles & amphibiens de Belgique',
      description: 'Découvrez les serpents, lézards, grenouilles et salamandres de Belgique.',
    },
    amazing_insects: {
      title: 'Insectes du monde',
      description: 'Explorez la diversité incroyable des insectes, des papillons colorés aux scarabées étranges.',
    },
    mediterranean_flora: {
      title: 'Flore méditerranéenne',
      description: 'Les plantes, arbres et fleurs typiques du bassin méditerranéen.',
    },
    great_barrier_reef_life: {
      title: 'Vie marine de la grande barrière de corail',
      description: 'Poissons, coraux et mollusques du plus grand récif corallien du monde.',
    },
  },
  customFilter: {
    include_title: 'Taxons à INCLURE',
    include_description: 'Ajoutez les groupes que vous souhaitez voir dans le quiz.',
    exclude_title: 'Taxons à EXCLURE',
    exclude_description: 'Ajoutez les groupes que vous souhaitez retirer du quiz.',
    placeholder: '(ex: oiseaux, cervidés, champignons, passereaux...)',
    remove_taxon: 'Retirer ce taxon',
    filter_by_place: 'Filtrer par lieu',
    filter_by_date: 'Filtrer par date',
    date_from: 'Du',
    date_to: 'Au',
  },
  geo: {
    tab_place: 'Lieu',
    tab_map: 'Carte',
    place_placeholder: 'Cherchez un pays, une région, un parc…',
    remove_place: 'Retirer {name}',
    add_place: 'Ajouter',
    bbox_label: 'BBox : NE({nelat}, {nelng}) — SW({swlat}, {swlng})',
    map_hint:
      'Astuces : faites glisser les coins ou bords, déplacez le carré central pour changer de zone, Shift + glisser pour dessiner un nouveau rectangle.',
  },
  easy: {
    question_counter: 'Question {current}/{total}',
    hint_button: 'Indice (-{cost} pts)',
    image_alt: 'Quelle est cette espèce ?',
    score_label: 'Score : {score}',
  },
  hard: {
    title: "Identifier l'espèce",
    stats_line: 'Chances : {guesses} | Score : {score}',
    reveal_button: 'Révéler (-{cost} chances)',
    image_alt: 'Espèce à identifier',
    rank_placeholder: 'Entrez un {rank}...',
    feedback: {
      branch: 'Bonne branche ! +{points} points !',
      redundant: "Correct, mais cette proposition n'a pas révélé de nouveau rang.",
      wrong_branch: "Incorrect. Cette suggestion n'est pas dans la bonne lignée.",
      error: 'Une erreur est survenue lors de la vérification.',
      not_enough_guesses: 'Pas assez de chances pour cet indice !',
      hint_used: 'Indice utilisé ! Le rang "{rank}" a été révélé.',
    },
  },
  imageViewer: {
    loading: 'Chargement...',
    nav_label: 'Contrôles de navigation',
    previous: 'Image précédente',
    next: 'Image suivante',
    choose_image: "Choix de l'image",
    go_to_image: "Aller à l'image {index}",
    viewer_label: "Visionneuse d'images",
  },
  summary: {
    win_title: '🎉 Espèce trouvée !',
    lose_title: '😟 Dommage !',
    answer_intro: 'La réponse était :',
    points: 'Points gagnés :',
    bonus: 'Bonus :',
    streak_bonus: 'Bonus de série :',
    total: 'Total pour la manche :',
    links: {
      inaturalist: 'Voir sur iNaturalist',
      wikipedia: 'Page Wikipédia',
    },
  },
  end: {
    final_score: 'Score final :',
    correct_count: '{correct} / {total} correctes',
    accuracy: 'Précision {value}%',
    species_seen: 'Espèces rencontrées',
    achievements: 'Succès débloqués',
    status: {
      correct: 'Correct',
      incorrect: 'Incorrect',
    },
    links: {
      inaturalist: 'iNaturalist',
      wikipedia: 'Wikipédia',
    },
  },
  achievements: {
    modal_title: 'Succès débloqué !',
    list: {
      first_game: {
        title: 'Premier Pas',
        description: 'Terminer votre toute première partie.',
      },
      ten_games: {
        title: 'Habitué',
        description: 'Terminer 10 parties.',
      },
      high_score_10k: {
        title: 'Naturaliste Aguerri',
        description: 'Atteindre un score total de 10 000 XP.',
      },
      globetrotter: {
        title: 'Globe-trotter',
        description: 'Jouer à 3 packs de jeu différents.',
      },
      LEVEL_5: {
        title: 'Apprenti Naturaliste',
        description: 'Atteindre le niveau 5.',
      },
      LEVEL_10: {
        title: 'Naturaliste Confirmé',
        description: 'Atteindre le niveau 10.',
      },
      ACCURACY_HARD_75: {
        title: 'Expert du Terrain',
        description: 'Atteindre 75% de précision en mode Difficile (min. 25 questions).',
      },
      MASTER_5_SPECIES: {
        title: 'Spécialiste',
        description: 'Maîtriser 5 espèces différentes (3 bonnes réponses pour chacune).',
      },
    },
  },
  help: {
    title: 'Bienvenue sur Inaturamouche !',
    gameplay_title: 'Principe du jeu',
    gameplay_body:
      "Le but est d'identifier des espèces (animaux, plantes, champignons...) à partir d'une photo. Le jeu utilise les données réelles de la plateforme de science participative iNaturalist.",
    modes_title: 'Modes de jeu',
    modes_easy:
      'Facile : un quiz à choix multiples. Idéal pour découvrir de nouvelles espèces de manière détendue.',
    modes_hard:
      'Difficile : retrouvez la classification complète (règne, classe, etc.). Chaque bonne proposition révèle un rang supplémentaire.',
    packs_title: 'Packs de jeu',
    packs_body:
      'Choisissez un pack thématique (oiseaux du monde, mammifères de France...) ou créez votre partie personnalisée !',
    confirm: 'Compris !',
  },
  errors: {
    title: 'Erreur',
    quiz_no_results: 'Aucune espèce trouvée, élargissez la recherche.',
    generic: 'Une erreur est survenue. Réessayez plus tard.',
  },
  profile: {
    back: '← Retour',
    title: 'Profil du joueur',
    tabs: {
      summary: 'Résumé',
      stats: 'Statistiques',
      achievements: 'Succès',
    },
    level: 'Niveau {level}',
    xp_counter: '{current} / {total} XP',
    summary_title: 'Statistiques clés',
    stats_labels: {
      xp: 'XP total',
      games: 'Parties jouées',
      accuracy: 'Précision globale',
    },
    reset_button: 'Réinitialiser le profil',
    reset_confirm: 'Voulez-vous vraiment réinitialiser votre profil ?',
    accuracy_title: 'Précision par mode',
    modes: {
      easy: 'Mode facile',
      hard: 'Mode difficile',
    },
    pack_stats_title: 'Statistiques par pack',
    pack_accuracy: '{correct}/{answered} ({accuracy}%)',
    no_pack_stats: 'Aucun pack joué.',
    mastery_title: 'Maîtrise (Top 5)',
    mastery_loading: 'Chargement...',
    mastery_empty: 'Aucune espèce maîtrisée.',
    mastery_count: 'Maîtrisé {count} fois',
    achievements_title: 'Succès ({count} / {total})',
    loading: 'Chargement du profil…',
  },
  ranks: {
    kingdom: 'Règne',
    phylum: 'Embranchement',
    class: 'Classe',
    order: 'Ordre',
    family: 'Famille',
    genus: 'Genre',
    species: 'Espèce',
  },
  streak: {
    aria_label: 'Série de {count} bonnes réponses',
  },
};

export default fr;
