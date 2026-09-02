/**
 * Дополнения к RU_DICT (js/ru-dict.js) — подключать ПОСЛЕ него отдельным
 * <script>. Сделано отдельным файлом, а не правкой ru-dict.js целиком:
 * переносить вручную весь существующий словарь (900+ записей) в новый
 * файл — ненужный риск опечатки/потери записи. Просто добавляет то,
 * чего не хватало.
 */
Object.assign(RU_DICT, {
  "deposit_detection_range": "радиус обнаружения залежей",
  "gathering_yield_bonus": "бонус выхода при добыче",
  "rare_material_chance": "шанс редкого материала",
  "gathering_speed": "скорость добычи",
  "crafting_critical_chance": "шанс крафт-крита",
  "per_profession_level": "за уровень профессии",

  // профессии / способности сбора ресурсов
  "deposit_detection_range": "радиус обнаружения залежей",
  "gathering_yield_bonus": "бонус выхода при добыче",
  "rare_material_chance": "шанс редкого материала",
  "gathering_speed": "скорость добычи",
  "crafting_critical_chance": "шанс крафт-крита",
  "per_profession_level": "за уровень профессии",
 
  // лекарственные эффекты (medicinal_effect_categories.json)
  "healing": "Восстановление здоровья",
  "cure_ailment": "Лечит конкретный недуг",
  "stimulant": "Стимулятор",
  "trance": "Транс",
  "immunity_boost": "Усиление иммунитета",
  "pain_relief": "Обезболивание",
  "sleep_aid": "Снотворное",
  "hallucinogenic": "Галлюциноген",
 
  // способы магического применения (magic_application_methods.json)
  "ingest": "Съесть/выпить",
  "apply_to_weapon": "Нанести на оружие",
  "burn_as_incense": "Сжечь как благовоние",
  "wear_as_charm": "Носить как амулет",
  "brew_into_potion": "Сварить в зелье",
 
  // тип действия эффекта (magic_duration_types.json)
  "instant": "Мгновенное",
  "temporary": "Временное",
  "permanent": "Постоянное",
 
  // съедобность (edibility_preparation.json / edibility_context.json)
  "must_be_processed": "Требует обработки",
  "standalone": "Отдельно",
  "ingredient_in_dish": "В составе блюда",
  "seasoning": "Как приправа",
 
  // токсичность (toxicity_severity.json / toxicity_onset.json)
  "mild": "Лёгкая",
  "moderate": "Средняя",
  "severe": "Тяжёлая",
  "lethal": "Смертельная",
  "immediate": "Немедленное",
  "delayed": "Отложенное"
});