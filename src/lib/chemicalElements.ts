/** Symbols and atomic numbers: IUPAC periodic table, 4 May 2022.
 * https://iupac.org/wp-content/uploads/2022/05/IUPAC_Periodic_Table-04May22.pdf
 * Russian names of 113/115/117/118: https://www.jinr.ru/posts/otkrytie-sverhtyazhelyh-elementov-novoe-popolnenie/
 */
const names = [
  ['H', 'Водород'], ['He', 'Гелий'], ['Li', 'Литий'], ['Be', 'Бериллий'],
  ['B', 'Бор'], ['C', 'Углерод'], ['N', 'Азот'], ['O', 'Кислород'], ['F', 'Фтор'], ['Ne', 'Неон'],
  ['Na', 'Натрий'], ['Mg', 'Магний'], ['Al', 'Алюминий'], ['Si', 'Кремний'], ['P', 'Фосфор'],
  ['S', 'Сера'], ['Cl', 'Хлор'], ['Ar', 'Аргон'], ['K', 'Калий'], ['Ca', 'Кальций'],
  ['Sc', 'Скандий'], ['Ti', 'Титан'], ['V', 'Ванадий'], ['Cr', 'Хром'], ['Mn', 'Марганец'],
  ['Fe', 'Железо'], ['Co', 'Кобальт'], ['Ni', 'Никель'], ['Cu', 'Медь'], ['Zn', 'Цинк'],
  ['Ga', 'Галлий'], ['Ge', 'Германий'], ['As', 'Мышьяк'], ['Se', 'Селен'], ['Br', 'Бром'], ['Kr', 'Криптон'],
  ['Rb', 'Рубидий'], ['Sr', 'Стронций'], ['Y', 'Иттрий'], ['Zr', 'Цирконий'], ['Nb', 'Ниобий'],
  ['Mo', 'Молибден'], ['Tc', 'Технеций'], ['Ru', 'Рутений'], ['Rh', 'Родий'], ['Pd', 'Палладий'],
  ['Ag', 'Серебро'], ['Cd', 'Кадмий'], ['In', 'Индий'], ['Sn', 'Олово'], ['Sb', 'Сурьма'],
  ['Te', 'Теллур'], ['I', 'Иод'], ['Xe', 'Ксенон'], ['Cs', 'Цезий'], ['Ba', 'Барий'],
  ['La', 'Лантан'], ['Ce', 'Церий'], ['Pr', 'Празеодим'], ['Nd', 'Неодим'], ['Pm', 'Прометий'],
  ['Sm', 'Самарий'], ['Eu', 'Европий'], ['Gd', 'Гадолиний'], ['Tb', 'Тербий'], ['Dy', 'Диспрозий'],
  ['Ho', 'Гольмий'], ['Er', 'Эрбий'], ['Tm', 'Тулий'], ['Yb', 'Иттербий'], ['Lu', 'Лютеций'],
  ['Hf', 'Гафний'], ['Ta', 'Тантал'], ['W', 'Вольфрам'], ['Re', 'Рений'], ['Os', 'Осмий'],
  ['Ir', 'Иридий'], ['Pt', 'Платина'], ['Au', 'Золото'], ['Hg', 'Ртуть'], ['Tl', 'Таллий'],
  ['Pb', 'Свинец'], ['Bi', 'Висмут'], ['Po', 'Полоний'], ['At', 'Астат'], ['Rn', 'Радон'],
  ['Fr', 'Франций'], ['Ra', 'Радий'], ['Ac', 'Актиний'], ['Th', 'Торий'], ['Pa', 'Протактиний'],
  ['U', 'Уран'], ['Np', 'Нептуний'], ['Pu', 'Плутоний'], ['Am', 'Америций'], ['Cm', 'Кюрий'],
  ['Bk', 'Берклий'], ['Cf', 'Калифорний'], ['Es', 'Эйнштейний'], ['Fm', 'Фермий'], ['Md', 'Менделевий'],
  ['No', 'Нобелий'], ['Lr', 'Лоуренсий'], ['Rf', 'Резерфордий'], ['Db', 'Дубний'], ['Sg', 'Сиборгий'],
  ['Bh', 'Борий'], ['Hs', 'Хассий'], ['Mt', 'Мейтнерий'], ['Ds', 'Дармштадтий'], ['Rg', 'Рентгений'],
  ['Cn', 'Коперниций'], ['Nh', 'Нихоний'], ['Fl', 'Флеровий'], ['Mc', 'Московий'],
  ['Lv', 'Ливерморий'], ['Ts', 'Теннессин'], ['Og', 'Оганесон'],
] as const;

export type ChemicalElement = { symbol: string; name: string; atomicNumber: number };
export const chemicalElements: ChemicalElement[] = names.map(([symbol, name], index) => ({
  symbol, name, atomicNumber: index + 1,
}));
export const elementsBySymbol = new Map(chemicalElements.map(element => [element.symbol, element]));
export const commonElementSymbols = ['H', 'C', 'N', 'O', 'Na', 'Mg', 'Al', 'S', 'Cl', 'K', 'Ca', 'Fe', 'Cu', 'Zn'];

function shortPeriod(left: string[], right: string[]): (string | null)[] {
  return [...left, ...Array<null>(18 - left.length - right.length).fill(null), ...right];
}

/** Range cells link the main table to the two complete f-block rows below. */
export const periodicTableRows = [
  shortPeriod(['H'], ['He']),
  shortPeriod(['Li', 'Be'], ['B', 'C', 'N', 'O', 'F', 'Ne']),
  shortPeriod(['Na', 'Mg'], ['Al', 'Si', 'P', 'S', 'Cl', 'Ar']),
  'K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr'.split(' '),
  'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe'.split(' '),
  'Cs Ba 57–71 Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn'.split(' '),
  'Fr Ra 89–103 Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '),
  [null, null, ...chemicalElements.slice(56, 71).map(element => element.symbol), null],
  [null, null, ...chemicalElements.slice(88, 103).map(element => element.symbol), null],
];

export function findChemicalElements(search: string): ChemicalElement[] {
  const query = search.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  return chemicalElements.filter(element => element.symbol.toLowerCase().startsWith(query)
    || element.name.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').includes(query)
    || (element.symbol === 'I' && 'йод'.includes(query))
    || String(element.atomicNumber) === query);
}
