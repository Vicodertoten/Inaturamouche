import en from './client/src/locales/en.js' with { type: 'json' };
import fr from './client/src/locales/fr.js' with { type: 'json' };
import nl from './client/src/locales/nl.js' with { type: 'json' };

// Vérifier qu'il s'agit de clés spéciales qui ne doivent pas être traduites
console.log('=== Vérification des clés rémanentes ===\n');

console.log('common.question_counter EN:', en.common.question_counter);
console.log('common.question_counter FR:', fr.common.question_counter);
console.log('-> Format {current}/{total} identique partout (normal)\n');

console.log('configurator.option_images EN:', en.configurator.option_images);
console.log('configurator.option_images FR:', fr.configurator.option_images);
console.log('-> Option générique "Images" identique en FR (peut être traduit)\n');

console.log('profile.pack_accuracy EN:', en.profile.pack_accuracy);
console.log('profile.pack_accuracy FR:', fr.profile.pack_accuracy);
console.log('-> Format {correct}/{answered} ({accuracy}%) identique partout (normal)\n');

console.log('profile.xp_counter EN:', en.profile.xp_counter);
console.log('profile.xp_counter FR:', fr.profile.xp_counter);
console.log('-> Format {current} / {total} XP identique partout (normal)\n');

console.log('achievements.list.MASTER_5_SPECIES.title EN:', en.achievements.list.MASTER_5_SPECIES.title);
console.log('achievements.list.MASTER_5_SPECIES.title NL:', nl.achievements.list.MASTER_5_SPECIES.title);
console.log('-> "Specialist" est identique en anglais et néerlandais (peut être traduit différemment)\n');

console.log('easy.question_counter EN:', en.easy.question_counter);
console.log('easy.question_counter FR:', fr.easy.question_counter);
console.log('-> Identique au common.question_counter (normal)\n');
